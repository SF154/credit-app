import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ReviewPanel } from '@/components/applications/ReviewPanel'
import type {
  Application,
  FormTemplateWithSections,
  FormTemplateField,
  ApplicationFieldResponse,
  ApplicationFile,
} from '@/types'

interface SignedFile {
  fieldId: string
  filename: string
  signedUrl: string | null
}

type RouteContext = { params: Promise<{ applicationId: string }> }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReadonlyField({
  field,
  responses,
  signedFiles,
}: {
  field: FormTemplateField
  responses: ApplicationFieldResponse[]
  signedFiles: SignedFile[]
}) {
  const response = responses.find((r) => r.field_id === field.id)
  const signedFile = signedFiles.find((f) => f.fieldId === field.id)

  let content: React.ReactNode = <span className="text-sm text-zinc-400 italic">No response</span>

  if (field.field_type === 'signature' && response?.value_json) {
    content = (
      <img
        src={response.value_json as string}
        alt="Signature"
        className="max-h-24 border border-zinc-200 rounded-lg bg-white p-1"
      />
    )
  } else if (field.field_type === 'file' && signedFile) {
    content = signedFile.signedUrl ? (
      <a
        href={signedFile.signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-blue-700 underline underline-offset-2 hover:text-blue-900"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {signedFile.filename}
      </a>
    ) : (
      <span className="text-sm text-zinc-500">{signedFile.filename} (link unavailable)</span>
    )
  } else if (field.field_type === 'boolean') {
    content = (
      <span className="text-sm text-zinc-800">
        {response?.value_text === 'true' ? 'Yes' : response?.value_text === 'false' ? 'No' : '—'}
      </span>
    )
  } else if (response?.value_text) {
    content = (
      <span className="text-sm text-zinc-800 whitespace-pre-wrap">{response.value_text}</span>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {field.label}
        {field.is_required && <span className="ml-1 text-red-400">*</span>}
      </span>
      {content}
    </div>
  )
}

export default async function SubmissionReviewPage({ params }: RouteContext) {
  const { applicationId } = await params
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

  // Fetch application with template + sections + fields
  const { data: app } = await supabase
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
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!app || app.company_id !== profile.company_id) notFound()

  const [{ data: responses }, { data: files }] = await Promise.all([
    supabase.from('application_field_responses').select('*').eq('application_id', applicationId),
    supabase.from('application_files').select('*').eq('application_id', applicationId),
  ])

  // Generate signed URLs for all files
  const signedFiles: SignedFile[] = await Promise.all(
    (files ?? []).map(async (file: ApplicationFile) => {
      const { data } = await supabase.storage
        .from('application-files')
        .createSignedUrl(file.storage_path, 3600)
      return { fieldId: file.field_id, filename: file.filename, signedUrl: data?.signedUrl ?? null }
    })
  )

  // Signed URL for the signed T&C PDF (if present)
  let termsSignedUrl: string | null = null
  const termsPath = (app as Application).terms_signed_pdf_path
  if (termsPath) {
    const { data: termsData } = await supabase.storage
      .from('application-files')
      .createSignedUrl(termsPath, 3600)
    termsSignedUrl = termsData?.signedUrl ?? null
  }

  const application = app as Application & { form_templates: FormTemplateWithSections }
  const template = application.form_templates
  const typeLabel = template.type === 'credit' ? 'Credit' : 'COD'

  // Sort sections and fields by display_order
  const sections = [...template.form_template_sections].sort(
    (a, b) => a.display_order - b.display_order
  )

  const alreadyActioned = application.status !== 'submitted'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link + header */}
      <div>
        <Link
          href="/dashboard/applications/submitted"
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          ← Submitted Applications
        </Link>
        <div className="mt-3">
          <h1 className="text-xl font-semibold text-zinc-900">{app.applicant_company}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {typeLabel} Application · {app.applicant_email}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Template</span>
          <p className="mt-0.5 text-zinc-800">{template.name}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Submitted</span>
          <p className="mt-0.5 text-zinc-800">{formatDate(app.submitted_at)}</p>
        </div>
      </div>

      {/* Field responses */}
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-6 space-y-8">
        {sections.map((section) => {
          const fields = [...section.form_template_fields].sort(
            (a, b) => a.display_order - b.display_order
          )
          return (
            <div key={section.id} className="space-y-5">
              <h2 className="text-sm font-semibold text-zinc-800 border-b border-zinc-100 pb-2">
                {section.label}
              </h2>
              <div className="space-y-5">
                {fields.map((field) => (
                  <ReadonlyField
                    key={field.id}
                    field={field}
                    responses={(responses ?? []) as ApplicationFieldResponse[]}
                    signedFiles={signedFiles}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Signed T&C */}
      {termsSignedUrl && (
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">Signed Terms &amp; Conditions</h2>
          <a
            href={termsSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            signed_terms.pdf
          </a>
        </div>
      )}

      {/* Review action */}
      {alreadyActioned ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
          This application was already actioned on {formatDate(app.reviewed_at)}.
        </div>
      ) : (
        <ReviewPanel applicationId={applicationId} />
      )}
    </div>
  )
}
