import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function SubmittedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = getSupabaseServerClient()

  const { data: app } = await supabase
    .from('applications')
    .select('applicant_company, form_templates(name)')
    .eq('token', token)
    .single()

  const applicantCompany = app?.applicant_company ?? 'your company'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Application Submitted</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          Thank you, <strong>{applicantCompany}</strong>. Your application has been submitted successfully.
          The team will review it and be in touch with you shortly.
        </p>
      </div>
    </div>
  )
}
