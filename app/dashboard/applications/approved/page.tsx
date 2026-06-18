import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { RenewalDateInput } from '@/components/applications/RenewalDateInput'
import type { ApplicationWithTemplate } from '@/types'

async function getApprovedApplications(companyId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('applications')
    .select('*, form_templates(name, type)')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ApplicationWithTemplate[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntilRenewal(renewalDate: string | null): { label: string; overdue: boolean } | null {
  if (!renewalDate) return null
  const diff = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86_400_000)
  if (diff === 0) return { label: 'Today', overdue: false }
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true }
  return { label: `${diff} days`, overdue: false }
}

export default async function ApprovedPage() {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session) redirect('/login')

  const supabase = getSupabaseServerClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  const applications = await getApprovedApplications(profile.company_id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Approved Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Approved accounts. Set renewal dates to track when accounts are due for review.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No approved applications yet.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Applications appear here once they have been approved.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Applicant</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Template</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Approval Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Renewal Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Days Until Renewal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {applications.map((app) => {
                const renewal = daysUntilRenewal(app.renewal_date)
                return (
                  <tr key={app.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{app.applicant_company}</div>
                      <div className="text-xs text-zinc-500">{app.applicant_email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{app.form_templates?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(app.reviewed_at)}</td>
                    <td className="px-4 py-3">
                      <RenewalDateInput
                        applicationId={app.id}
                        initialDate={app.renewal_date}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {renewal ? (
                        <span className={renewal.overdue ? 'text-red-600 font-medium' : 'text-zinc-600'}>
                          {renewal.label}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
