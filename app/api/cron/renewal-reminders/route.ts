import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/ses'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildRenewalReminderEmail(
  applicantCompany: string,
  templateType: string,
  renewalDate: string,
  appUrl: string
) {
  const typeLabel = templateType === 'credit' ? 'Credit' : 'COD'
  return {
    subject: `Renewal Reminder — ${applicantCompany}`,
    body: `Hi Team,

This is a reminder that the ${typeLabel} account for ${applicantCompany} is due for renewal today (${formatDate(renewalDate)}).

View Application: ${appUrl}/dashboard/applications/approved

Please review and take appropriate action.

Regards,
Credit App`,
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: applications, error } = await supabase
    .from('applications')
    .select('id, applicant_company, renewal_date, company_id, form_templates(type)')
    .eq('status', 'approved')
    .eq('renewal_date', today)
    .is('renewal_reminded_at', null)

  if (error) {
    console.error('Failed to fetch renewal applications:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let processed = 0
  const errors: string[] = []

  for (const app of applications ?? []) {
    const templateType = (app.form_templates as { type: string } | null)?.type ?? 'credit'

    // Fetch all users in this company
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('company_id', app.company_id)

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map((p: { user_id: string }) => p.user_id)
      const { data: users } = await supabase.from('user').select('email').in('id', userIds)

      const { subject, body } = buildRenewalReminderEmail(
        app.applicant_company,
        templateType,
        app.renewal_date!,
        appUrl
      )

      for (const user of users ?? []) {
        try {
          await sendEmail(user.email, subject, body)
        } catch (err) {
          const msg = `Failed to email ${user.email} for application ${app.id}: ${err instanceof Error ? err.message : String(err)}`
          console.error(msg)
          errors.push(msg)
        }
      }
    }

    // Mark as reminded regardless of individual email failures
    const { error: updateError } = await supabase
      .from('applications')
      .update({ renewal_reminded_at: new Date().toISOString() })
      .eq('id', app.id)

    if (updateError) {
      errors.push(`Failed to update renewal_reminded_at for application ${app.id}`)
    } else {
      processed++
    }
  }

  return NextResponse.json({ processed, errors: errors.length > 0 ? errors : undefined })
}
