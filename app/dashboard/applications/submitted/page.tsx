import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { ApplicationWithTemplate } from '@/types'

async function getSubmittedApplications(companyId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('applications')
    .select('*, form_templates(name, type)')
    .eq('company_id', companyId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ApplicationWithTemplate[]
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        type === 'credit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
      }`}
    >
      {type === 'credit' ? 'Credit' : 'COD'}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function SubmittedPage() {
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

  const applications = await getSubmittedApplications(profile.company_id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Submitted Applications</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Applications awaiting review and action.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No submitted applications.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Applications appear here once applicants complete and submit their forms.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Applicant</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Template</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Submitted</th>
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3">
                    <TypeBadge type={app.form_templates?.type ?? 'credit'} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(app.submitted_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/applications/submitted/${app.id}`}
                      className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Review →
                    </Link>
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
