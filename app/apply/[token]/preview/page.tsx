'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  Application,
  FormTemplateWithSections,
  ApplicationFieldResponse,
  ApplicationFile,
  FormTemplateField,
} from '@/types'

interface FormData {
  application: Application
  template: FormTemplateWithSections
  responses: ApplicationFieldResponse[]
  files: ApplicationFile[]
}

function ReadonlyField({ field, responses, files }: {
  field: FormTemplateField
  responses: ApplicationFieldResponse[]
  files: ApplicationFile[]
}) {
  const response = responses.find((r) => r.field_id === field.id)
  const file = files.find((f) => f.field_id === field.id)

  let content: React.ReactNode = <span className="text-gray-400 text-sm italic">No response</span>

  if (field.field_type === 'signature' && response?.value_json) {
    content = (
      <img
        src={response.value_json as string}
        alt="Signature"
        className="max-h-24 border border-gray-200 rounded-lg bg-white p-1"
      />
    )
  } else if (field.field_type === 'file' && file) {
    content = (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {file.filename}
      </span>
    )
  } else if (field.field_type === 'boolean') {
    content = <span className="text-sm text-gray-800">{response?.value_text === 'true' ? 'Yes' : response?.value_text === 'false' ? 'No' : '—'}</span>
  } else if (response?.value_text) {
    content = <span className="text-sm text-gray-800 whitespace-pre-wrap">{response.value_text}</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {field.label}
        {field.is_required && <span className="ml-1 text-red-400">*</span>}
      </span>
      {content}
    </div>
  )
}

export default function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)

  useEffect(() => {
    params.then(({ token: t }) => {
      setToken(t)
      fetch(`/api/apply/${t}`)
        .then(async (res) => {
          if (!res.ok) {
            router.push(`/apply/${t}`)
            return
          }
          const data = await res.json()
          setFormData(data)
        })
        .catch(() => router.push(`/apply/${t}`))
        .finally(() => setLoading(false))
    })
  }, [params, router])

  const handleSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/apply/${token}/submit`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        router.push(`/apply/${token}/submitted`)
      } else {
        setSubmitError(data.error === 'incomplete'
          ? 'Some required fields are missing. Please go back and complete the form.'
          : (data.error ?? 'Submission failed. Please try again.'))
      }
    } catch {
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!formData) return null

  const { application, template } = formData
  const typeLabel = template.type === 'credit' ? 'Credit' : 'COD'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">{application.applicant_company}</p>
          <h1 className="text-lg font-semibold text-gray-900">{template.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Please review your answers before submitting.</p>
        </div>
      </div>

      {/* Read-only field display */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-8">
          {template.form_template_sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-2">
                {section.label}
              </h2>
              <div className="flex flex-col gap-5">
                {section.form_template_fields.map((field) => (
                  <ReadonlyField
                    key={field.id}
                    field={field}
                    responses={formData.responses}
                    files={formData.files}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {submitError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Back to Edit
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          {typeLabel} Application · Once submitted, your answers cannot be changed
        </p>
      </div>
    </div>
  )
}
