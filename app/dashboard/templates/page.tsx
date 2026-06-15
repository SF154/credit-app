import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Copy, Pencil } from 'lucide-react'
import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import DeleteTemplateButton from './DeleteTemplateButton'

async function getTemplates(companyId: string) {
  const supabase = getSupabaseServerClient()

  const [{ data: defaults }, { data: custom }] = await Promise.all([
    supabase
      .from('form_templates')
      .select('id, name, type, is_default, created_at')
      .is('company_id', null)
      .eq('is_default', true)
      .order('created_at'),
    supabase
      .from('form_templates')
      .select('id, name, type, is_default, created_at')
      .eq('company_id', companyId)
      .order('created_at'),
  ])

  return { defaults: defaults ?? [], custom: custom ?? [] }
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        type === 'credit'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      {type === 'credit' ? 'Credit' : 'COD'}
    </span>
  )
}

export default async function TemplatesPage() {
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

  const { defaults, custom } = await getTemplates(profile.company_id)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Form Templates</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Duplicate a default template to create your own customised version.
          </p>
        </div>
      </div>

      {/* Default templates */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Default Templates
        </h2>
        <div className="space-y-2">
          {defaults.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <TypeBadge type={t.type} />
                <span className="text-sm font-medium text-zinc-900">{t.name}</span>
                <span className="text-xs text-zinc-400">Platform default · Read-only</span>
              </div>
              <Link
                href={`/dashboard/templates/new?from=${t.id}`}
                className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors border border-zinc-200 rounded-md px-3 py-1.5 hover:border-zinc-400"
              >
                <Copy size={14} />
                Duplicate
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Company templates */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
            My Templates
          </h2>
        </div>

        {custom.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-300 rounded-xl">
            <p className="text-sm text-zinc-500">No custom templates yet.</p>
            <p className="text-sm text-zinc-400 mt-1">
              Duplicate a default template above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {custom.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <TypeBadge type={t.type} />
                  <span className="text-sm font-medium text-zinc-900">{t.name}</span>
                  <span className="text-xs text-zinc-400">
                    Created {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/templates/new?from=${t.id}`}
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors px-2 py-1.5"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </Link>
                  <Link
                    href={`/dashboard/templates/${t.id}`}
                    className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors border border-zinc-200 rounded-md px-3 py-1.5 hover:border-zinc-400"
                  >
                    <Pencil size={14} />
                    Edit
                  </Link>
                  <DeleteTemplateButton templateId={t.id} templateName={t.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
