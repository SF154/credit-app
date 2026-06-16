import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { generateToken, tokenExpiresAt } from '@/lib/tokens'
import { sendEmail } from '@/lib/email/ses'

const SendApplicationSchema = z.object({
  templateId: z.string().uuid(),
  applicants: z
    .array(
      z.object({
        companyName: z.string().min(1, 'Company name is required'),
        email: z.string().email('Invalid email address'),
      })
    )
    .min(1),
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildEmail({
  applicantCompany,
  sendingCompany,
  templateType,
  appUrl,
  token,
  expiresAt,
  senderEmail,
}: {
  applicantCompany: string
  sendingCompany: string
  templateType: string
  appUrl: string
  token: string
  expiresAt: Date
  senderEmail: string
}) {
  const typeLabel = templateType === 'credit' ? 'Credit' : 'COD'
  const link = `${appUrl}/apply/${token}`

  return {
    subject: `${sendingCompany} — Your ${typeLabel} Application`,
    body: `Hi ${applicantCompany},

${sendingCompany} has sent you a ${typeLabel} application form to complete.

Please click the link below to access your form:

Complete Your Application: ${link}

This link will expire on ${formatDate(expiresAt)}.

If you have any questions, please contact ${senderEmail}.

Regards,
${sendingCompany}`,
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionCompany(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = SendApplicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { templateId, applicants } = parsed.data
  const supabase = getSupabaseServerClient()

  // Verify template belongs to this company or is a platform default
  const { data: template, error: templateError } = await supabase
    .from('form_templates')
    .select('id, type')
    .eq('id', templateId)
    .or(`company_id.is.null,company_id.eq.${ctx.companyId}`)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Fetch company name for email
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', ctx.companyId)
    .single()

  const sendingCompany = company?.name ?? 'Your contact'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const results = []

  for (const applicant of applicants) {
    const token = generateToken()
    const expiresAt = tokenExpiresAt()

    // Create application record
    const { data: application, error: insertError } = await supabase
      .from('applications')
      .insert({
        company_id: ctx.companyId,
        template_id: templateId,
        sent_by_user_id: ctx.user.id,
        applicant_company: applicant.companyName,
        applicant_email: applicant.email,
        token,
        token_expires_at: expiresAt.toISOString(),
        status: 'sent',
      })
      .select('id')
      .single()

    if (insertError || !application) {
      results.push({
        applicantEmail: applicant.email,
        applicationId: null,
        emailSent: false,
        error: 'Failed to create application record',
      })
      continue
    }

    // Send invitation email
    let emailSent = false
    let emailError: string | undefined

    try {
      const { subject, body: emailBody } = buildEmail({
        applicantCompany: applicant.companyName,
        sendingCompany,
        templateType: template.type,
        appUrl,
        token,
        expiresAt,
        senderEmail: ctx.user.email,
      })
      await sendEmail(applicant.email, subject, emailBody)
      emailSent = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email delivery failed'
    }

    results.push({
      applicantEmail: applicant.email,
      applicationId: application.id,
      emailSent,
      ...(emailError ? { error: emailError } : {}),
    })
  }

  return NextResponse.json({ results }, { status: 201 })
}
