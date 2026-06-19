'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type {
  Application,
  FormTemplateWithSections,
  ApplicationFieldResponse,
  ApplicationFile,
} from '@/types'
import FormRenderer, { type FormRendererHandle } from '@/components/form-renderer/FormRenderer'

interface FormData {
  application: Application
  template: FormTemplateWithSections
  responses: ApplicationFieldResponse[]
  files: ApplicationFile[]
}

type ErrorState =
  | { type: 'not_found' }
  | { type: 'expired'; applicantCompany?: string }
  | { type: 'submitted' | 'approved' | 'rejected'; applicantCompany?: string }

function ErrorPage({ error }: { error: ErrorState }) {
  const messages: Record<string, { title: string; body: string }> = {
    not_found: { title: 'Link not found', body: 'This application link is invalid. Please contact the sender.' },
    expired: { title: 'Link expired', body: 'This application link has expired. Please contact the sender to request a new link.' },
    submitted: { title: 'Already submitted', body: 'This application has already been submitted. Thank you!' },
    approved: { title: 'Application approved', body: 'This application has been approved. No further action is needed.' },
    rejected: { title: 'Application closed', body: 'This application has been closed. Please contact the sender for more information.' },
  }
  const msg = messages[error.type] ?? messages.not_found
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{msg.title}</h1>
        <p className="text-gray-600 text-sm">{msg.body}</p>
      </div>
    </div>
  )
}

type ResponseEntry = { valueText?: string; valueJson?: unknown }

export default function ApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const rendererRef = useRef<FormRendererHandle>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingResponsesRef = useRef<{ fieldId: string; valueText?: string; valueJson?: unknown }[]>([])

  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorState | null>(null)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [completionPct, setCompletionPct] = useState(0)
  const [saving, setSaving] = useState(false)

  // Track response values and uploaded file field IDs in ApplyPage so allFilled
  // can be computed reliably as a useMemo rather than via the imperative ref.
  const [currentResponseMap, setCurrentResponseMap] = useState<Map<string, ResponseEntry>>(new Map())
  const [uploadedFileIds, setUploadedFileIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    params.then(({ token: t }) => {
      setToken(t)
      fetch(`/api/apply/${t}`)
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) {
            setError({ type: data.error, applicantCompany: data.applicantCompany })
          } else {
            setFormData(data)
            setCompletionPct(data.application.completion_pct ?? 0)
            // Seed local tracking state from saved DB data
            setCurrentResponseMap(
              new Map(
                (data.responses as ApplicationFieldResponse[]).map((r) => [
                  r.field_id,
                  { valueText: r.value_text ?? undefined, valueJson: r.value_json ?? undefined },
                ])
              )
            )
            setUploadedFileIds(new Set((data.files as ApplicationFile[]).map((f) => f.field_id)))
          }
        })
        .catch(() => setError({ type: 'not_found' }))
        .finally(() => setLoading(false))
    })
  }, [params])

  // Derived: true when every required field has a value AND T&C is satisfied
  const allFilled = useMemo(() => {
    if (!formData) return false
    const requiredFields = formData.template.form_template_sections
      .flatMap((s) => s.form_template_fields.filter((f) => f.is_required))
    const fieldsFilled =
      requiredFields.length === 0 ||
      requiredFields.every((field) => {
        if (field.field_type === 'file') return uploadedFileIds.has(field.id)
        const r = currentResponseMap.get(field.id)
        if (!r) return false
        if (r.valueText != null && r.valueText.trim() !== '') return true
        if (r.valueJson != null) return true
        return false
      })
    const termsRequired = !!formData.template.terms_pdf_path
    const termsSatisfied = !termsRequired || !!formData.application.terms_signed_pdf_path
    return fieldsFilled && termsSatisfied
  }, [formData, currentResponseMap, uploadedFileIds])

  // Show T&C banner whenever T&C is configured and not yet signed
  const showTermsBanner = useMemo(() => {
    if (!formData) return false
    return !!formData.template.terms_pdf_path && !formData.application.terms_signed_pdf_path
  }, [formData])

  const saveProgress = useCallback(
    async (responses: { fieldId: string; valueText?: string; valueJson?: unknown }[]) => {
      if (!token) return
      setSaving(true)
      try {
        const res = await fetch(`/api/apply/${token}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        })
        if (res.ok) {
          const { completion_pct } = await res.json()
          setCompletionPct(completion_pct)
        }
      } finally {
        setSaving(false)
      }
    },
    [token]
  )

  const handleChange = useCallback(
    (responses: { fieldId: string; valueText?: string; valueJson?: unknown }[]) => {
      pendingResponsesRef.current = responses
      setCurrentResponseMap(
        new Map(responses.map((r) => [r.fieldId, { valueText: r.valueText, valueJson: r.valueJson }]))
      )
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveProgress(pendingResponsesRef.current)
      }, 1500)
    },
    [saveProgress]
  )

  const handleFileUploaded = useCallback((fieldId: string) => {
    setUploadedFileIds((prev) => new Set([...prev, fieldId]))
  }, [])

  const handleReviewSubmit = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      saveProgress(pendingResponsesRef.current).then(() => {
        router.push(`/apply/${token}/preview`)
      })
    } else {
      router.push(`/apply/${token}/preview`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error) return <ErrorPage error={error} />
  if (!formData) return null

  const { application, template } = formData
  const typeLabel = template.type === 'credit' ? 'Credit' : 'COD'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">{application.applicant_company}</p>
          <h1 className="text-lg font-semibold text-gray-900">{template.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0 w-12 text-right">{completionPct}%</span>
            {saving && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <FormRenderer
          ref={rendererRef}
          sections={template.form_template_sections}
          savedResponses={formData.responses}
          savedFiles={formData.files}
          token={token}
          onChange={handleChange}
          onFileUploaded={handleFileUploaded}
        />

        {showTermsBanner && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-800">One more step required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Please review and sign the Terms &amp; Conditions before submitting.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/apply/${token}/terms`)}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Sign Terms &amp; Conditions →
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!allFilled}
            onClick={handleReviewSubmit}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Review &amp; Submit →
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          {typeLabel} Application · Progress is saved automatically
        </p>
      </div>
    </div>
  )
}
