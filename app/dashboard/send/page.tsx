'use client'

import { useState, useEffect } from 'react'
import { PlusCircle, Trash2, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface TemplateOption {
  id: string
  name: string
  type: 'credit' | 'cod'
}

interface ApplicantRow {
  id: string
  companyName: string
  email: string
}

interface SendResult {
  applicantEmail: string
  applicationId: string | null
  emailSent: boolean
  error?: string
}

function newRow(): ApplicantRow {
  return { id: crypto.randomUUID(), companyName: '', email: '' }
}

export default function SendPage() {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateId, setTemplateId] = useState('')
  const [applicants, setApplicants] = useState<ApplicantRow[]>([newRow()])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        const all: TemplateOption[] = [
          ...(data.defaults ?? []),
          ...(data.custom ?? []),
        ].map((t: { id: string; name: string; type: 'credit' | 'cod' }) => ({
          id: t.id,
          name: t.name,
          type: t.type,
        }))
        setTemplates(all)
      })
      .catch(() => setFetchError('Failed to load templates.'))
  }, [])

  function updateApplicant(id: string, field: 'companyName' | 'email', value: string) {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  function removeApplicant(id: string) {
    setApplicants((prev) => prev.filter((a) => a.id !== id))
  }

  function isValid() {
    if (!templateId) return false
    return applicants.every(
      (a) => a.companyName.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid()) return
    setLoading(true)
    setSubmitError('')
    setResults(null)

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          applicants: applicants.map((a) => ({
            companyName: a.companyName.trim(),
            email: a.email.trim(),
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error?.message ?? data.error ?? 'Something went wrong.')
        return
      }

      setResults(data.results)
      // Reset form on full success
      if (data.results.every((r: SendResult) => r.emailSent)) {
        setTemplateId('')
        setApplicants([newRow()])
      }
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const creditTemplates = templates.filter((t) => t.type === 'credit')
  const codTemplates = templates.filter((t) => t.type === 'cod')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Send Application</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Select a template and enter applicant details. Each applicant receives a unique link.
        </p>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {fetchError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template selector */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-700">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">Select a template…</option>
            {creditTemplates.length > 0 && (
              <optgroup label="Credit">
                {creditTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {codTemplates.length > 0 && (
              <optgroup label="COD">
                {codTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Applicant rows */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-700">Applicants</label>
          {applicants.map((applicant, index) => (
            <div key={applicant.id} className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Company name"
                  value={applicant.companyName}
                  onChange={(e) => updateApplicant(applicant.id, 'companyName', e.target.value)}
                  required
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={applicant.email}
                  onChange={(e) => updateApplicant(applicant.id, 'email', e.target.value)}
                  required
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <button
                type="button"
                onClick={() => removeApplicant(applicant.id)}
                disabled={applicants.length === 1}
                className="mt-2 text-zinc-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label={`Remove applicant ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setApplicants((prev) => [...prev, newRow()])}
            className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Another Applicant
          </button>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isValid()}
          className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Sending…' : `Send to ${applicants.length} Applicant${applicants.length > 1 ? 's' : ''}`}
        </button>
      </form>

      {/* Per-applicant results */}
      {results && (
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <p className="text-sm font-medium text-zinc-700">Results</p>
          {results.map((r) => (
            <div
              key={r.applicantEmail}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                r.emailSent
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {r.emailSent ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium">{r.applicantEmail}</span>
                {r.emailSent ? (
                  <span className="ml-2 text-green-700">— invitation sent</span>
                ) : (
                  <span className="ml-2 text-red-700">
                    — {r.applicationId ? 'application created but email failed' : 'failed'}: {r.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
