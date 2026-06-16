import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { ApplicationWithTemplate } from '@/types'

async function getIncompleteApplications(companyId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('applications')
    .select(`*, form_templates (name, type)`)
    .eq('company_id', companyId)
    .in('status', ['sent', 'in_progress', 'incomplete'])
    .order('sent_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ApplicationWithTemplate[]
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: 'bg-zinc-100 text-zinc-600',
    in_progress: 'bg-blue-100 text-blue-700',
    incomplete: 'bg-amber-100 text-amber-700',
  }
  const labels: Record<string, string> = {
    sent: 'Sent',
    in_progress: 'In Progress',
    incomplete: 'Incomplete',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Not yet opened'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function IncompletePage() {
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

  const applications = await getIncompleteApplications(profile.company_id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Incomplete Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Applications that have been sent but not yet submitted.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No incomplete applications.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Applications appear here after you send them.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Applicant</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Template</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Sent</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Last Opened</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Completion</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{app.applicant_company}</div>
                    <div className="text-xs text-zinc-500">{app.applicant_email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{app.form_templates?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(app.sent_at)}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(app.last_accessed_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-900 transition-all"
                          style={{ width: `${app.completion_pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500">{Math.round(app.completion_pct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
