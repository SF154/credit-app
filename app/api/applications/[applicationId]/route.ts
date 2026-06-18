import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/ses'

type RouteContext = { params: Promise<{ applicationId: string }> }

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildApprovedEmail(applicantCompany: string, companyName: string, templateType: string) {
  const typeLabel = templateType === 'credit' ? 'Credit' : 'COD'
  return {
    subject: `Your Application Has Been Approved — ${companyName}`,
    body: `Hi ${applicantCompany},

We're pleased to inform you that your ${typeLabel} application submitted to ${companyName} has been approved.

If you have any questions, please reach out to us directly.

Regards,
${companyName}`,
  }
}

function buildRejectedEmail(applicantCompany: string, companyName: string, templateType: string) {
  const typeLabel = templateType === 'credit' ? 'Credit' : 'COD'
  return {
    subject: `Regarding Your Application — ${companyName}`,
    body: `Hi ${applicantCompany},

Thank you for submitting your ${typeLabel} application to ${companyName}.

After review, we are unable to approve your application at this time.

If you would like to discuss this further, please contact us directly.

Regards,
${companyName}`,
  }
}

function buildIncompleteEmail(
  applicantCompany: string,
  companyName: string,
  templateType: string,
  appUrl: string,
  token: string,
  feedback?: string
) {
  const typeLabel = templateType === 'credit' ? 'Credit' : 'COD'
  const feedbackSection = feedback
    ? `\nFeedback from ${companyName}:\n${feedback}\n`
    : ''
  return {
    subject: `Action Required: Your Application Needs Attention — ${companyName}`,
    body: `Hi ${applicantCompany},

Your ${typeLabel} application submitted to ${companyName} requires some additional information or corrections before it can be processed.
${feedbackSection}
Please revisit your application using the link below:

Continue Your Application: ${appUrl}/apply/${token}

If you have any questions, please contact us.

Regards,
${companyName}`,
  }
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { applicationId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select(`
      *,
      form_templates (
        id, name, type,
        form_template_sections (
          id, label, display_order,
          form_template_fields (
            id, field_key, label, field_type, is_required, display_order, config
          )
        )
      ),
      application_field_responses (*),
      application_files (*)
    `)
    .eq('id', applicationId)
    .single()

  if (error || !app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.company_id !== session.companyId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(app)
}

const ReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'incomplete']),
  rejectionReason: z.string().optional(),
  incompleteFeedback: z.string().optional(),
  notes: z.string().optional(),
})

const RenewalSchema = z.object({
  renewalDate: z.string().nullable(),
})

const UpdateSchema = z.union([ReviewSchema, RenewalSchema])

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { applicationId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = getSupabaseServerClient()

  const { data: app, error: fetchError } = await supabase
    .from('applications')
    .select('*, form_templates(name, type)')
    .eq('id', applicationId)
    .single()

  if (fetchError || !app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.company_id !== session.companyId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Renewal date update — separate code path, no status transition
  if ('renewalDate' in parsed.data) {
    if (app.status !== 'approved') {
      return NextResponse.json({ error: 'Renewal date only applies to approved applications' }, { status: 409 })
    }
    await supabase
      .from('applications')
      .update({ renewal_date: parsed.data.renewalDate, updated_at: new Date().toISOString() })
      .eq('id', applicationId)
    return NextResponse.json({ success: true })
  }

  // Review action — status transition
  const { status, rejectionReason, incompleteFeedback, notes } = parsed.data
  if (app.status !== 'submitted') return NextResponse.json({ error: 'Already actioned' }, { status: 409 })

  const now = new Date()
  const updatePayload: Record<string, unknown> = {
    status,
    reviewed_at: now.toISOString(),
    reviewed_by: session.user.id,
    updated_at: now.toISOString(),
  }

  if (status === 'rejected') {
    updatePayload.rejection_reason = rejectionReason
  }

  if (status === 'incomplete') {
    const newExpiry = new Date(now)
    newExpiry.setDate(newExpiry.getDate() + 30)
    updatePayload.token_expires_at = newExpiry.toISOString()
  }

  const { error: updateError } = await supabase
    .from('applications')
    .update(updatePayload)
    .eq('id', applicationId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }

  await supabase.from('application_status_history').insert({
    application_id: applicationId,
    from_status: app.status,
    to_status: status,
    changed_by: session.user.id,
    notes: notes ?? null,
  })

  // Fetch company name for emails
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', session.companyId)
    .single()

  const companyName = company?.name ?? 'Your contact'
  const templateType = (app.form_templates as { type: string } | null)?.type ?? 'credit'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    if (status === 'approved') {
      const { subject, body: emailBody } = buildApprovedEmail(
        app.applicant_company,
        companyName,
        templateType
      )
      await sendEmail(app.applicant_email, subject, emailBody)
    } else if (status === 'rejected') {
      const { subject, body: emailBody } = buildRejectedEmail(
        app.applicant_company,
        companyName,
        templateType
      )
      await sendEmail(app.applicant_email, subject, emailBody)
    } else if (status === 'incomplete') {
      const { subject, body: emailBody } = buildIncompleteEmail(
        app.applicant_company,
        companyName,
        templateType,
        appUrl,
        app.token,
        incompleteFeedback
      )
      await sendEmail(app.applicant_email, subject, emailBody)
    }
  } catch (err) {
    console.error(`Failed to send review email for application ${applicationId}:`, err)
  }

  return NextResponse.json({ success: true })
}
