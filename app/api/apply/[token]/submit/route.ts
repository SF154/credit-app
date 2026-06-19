import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/ses'
import { calculateCompletionPct } from '@/lib/completion'
import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'

type RouteContext = { params: Promise<{ token: string }> }

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('*, form_templates(type, name), terms_signed_pdf_path')
    .eq('token', token)
    .single()

  if (error || !app) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (!['sent', 'in_progress', 'incomplete'].includes(app.status)) {
    return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
  }

  // Verify all required fields are filled
  const { data: template } = await supabase
    .from('form_templates')
    .select('*, form_template_sections(*, form_template_fields(*))')
    .eq('id', app.template_id)
    .single()

  const [{ data: responses }, { data: files }] = await Promise.all([
    supabase.from('application_field_responses').select('*').eq('application_id', app.id),
    supabase.from('application_files').select('*').eq('application_id', app.id),
  ])

  const sections = (template?.form_template_sections ?? []) as FormTemplateSectionWithFields[]
  const termsRequired = !!(template as { terms_pdf_path?: string | null } | null)?.terms_pdf_path
  const termsSigned = !!(app as { terms_signed_pdf_path?: string | null }).terms_signed_pdf_path

  if (termsRequired && !termsSigned) {
    return NextResponse.json({ error: 'terms_required' }, { status: 422 })
  }

  const pct = calculateCompletionPct(
    sections,
    (responses ?? []) as ApplicationFieldResponse[],
    (files ?? []) as ApplicationFile[],
    { termsRequired, termsSigned }
  )

  if (pct < 100) {
    return NextResponse.json({ error: 'incomplete', completion_pct: pct }, { status: 422 })
  }

  const submittedAt = new Date()

  // Update application status
  await supabase
    .from('applications')
    .update({ status: 'submitted', submitted_at: submittedAt.toISOString(), completion_pct: 100 })
    .eq('id', app.id)

  // Insert status history
  await supabase.from('application_status_history').insert({
    application_id: app.id,
    from_status: app.status,
    to_status: 'submitted',
    changed_by: null,
  })

  // Send Email 2 to all company users
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('company_id', app.company_id)

  if (profiles && profiles.length > 0) {
    const userIds = profiles.map((p: { user_id: string }) => p.user_id)
    const { data: users } = await supabase.from('user').select('email').in('id', userIds)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const reviewLink = `${appUrl}/dashboard/applications/submitted/${app.id}`
    const typeLabel = (app.form_templates as { type: string })?.type === 'credit' ? 'Credit' : 'COD'

    const subject = `New Application Submitted — ${app.applicant_company}`
    const body = `Hi Team,

A ${typeLabel} application from ${app.applicant_company} (${app.applicant_email}) has been submitted and is ready for review.

Review Application: ${reviewLink}

Submitted at: ${formatDate(submittedAt)}

Regards,
Credit App`

    for (const user of users ?? []) {
      try {
        await sendEmail(user.email, subject, body)
      } catch {
        // Non-fatal — log but don't fail the submission
        console.error(`Failed to notify ${user.email}`)
      }
    }
  }

  return NextResponse.json({ success: true })
}
