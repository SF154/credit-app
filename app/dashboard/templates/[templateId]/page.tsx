'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, FileText, Upload, Trash2 } from 'lucide-react'
import SectionList from '@/components/form-builder/SectionList'
import { EditableSection } from '@/components/form-builder/SectionEditor'
import { FormTemplateWithSections } from '@/types'

function toEditableSections(template: FormTemplateWithSections): EditableSection[] {
  return (template.form_template_sections ?? [])
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({
      id: s.id,
      label: s.label,
      display_order: s.display_order,
      fields: (s.form_template_fields ?? [])
        .sort((a, b) => a.display_order - b.display_order)
        .map((f) => ({
          id: f.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: f.display_order,
          config: f.config,
        })),
    }))
}

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const router = useRouter()

  const [template, setTemplate] = useState<FormTemplateWithSections | null>(null)
  const [name, setName] = useState('')
  const [sections, setSections] = useState<EditableSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [termsPdfPath, setTermsPdfPath] = useState<string | null>(null)
  const [termsUploading, setTermsUploading] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const termsFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/templates/${templateId}`)
      .then((r) => {
        if (r.status === 404) { router.push('/dashboard/templates'); return null }
        return r.json()
      })
      .then((data: FormTemplateWithSections | null) => {
        if (!data) return
        if (data.is_default) { router.push('/dashboard/templates'); return }
        setTemplate(data)
        setName(data.name)
        setSections(toEditableSections(data))
        setTermsPdfPath(data.terms_pdf_path ?? null)
        setLoading(false)
      })
  }, [templateId, router])

  const handleSectionsChange = useCallback((next: EditableSection[]) => {
    setSections(next)
    setIsDirty(true)
  }, [])

  function handleNameChange(value: string) {
    setName(value)
    setIsDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const body = {
      name,
      sections: sections.map((s, si) => ({
        ...(s.isNew ? {} : { id: s.id }),
        label: s.label,
        display_order: si * 10,
        fields: s.fields.map((f, fi) => ({
          ...(f.isNew ? {} : { id: f.id }),
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: fi * 10,
          config: f.config ?? null,
        })),
      })),
    }

    const res = await fetch(`/api/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setIsDirty(false)
      // Reload to get fresh IDs for any new sections/fields
      const fresh = await fetch(`/api/templates/${templateId}`).then((r) => r.json())
      setTemplate(fresh)
      setSections(toEditableSections(fresh))
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
    }

    setSaving(false)
  }

  async function handleTermsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setTermsUploading(true)
    setTermsError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/templates/${templateId}/terms-pdf`, { method: 'POST', body: fd })
    if (res.ok) {
      const data = await res.json()
      setTermsPdfPath(data.terms_pdf_path)
    } else {
      const data = await res.json()
      setTermsError(data.error ?? 'Upload failed')
    }
    setTermsUploading(false)
    if (termsFileRef.current) termsFileRef.current.value = ''
  }

  async function handleTermsRemove() {
    setTermsUploading(true)
    setTermsError(null)
    const res = await fetch(`/api/templates/${templateId}/terms-pdf`, { method: 'DELETE' })
    if (res.ok) {
      setTermsPdfPath(null)
    } else {
      const data = await res.json()
      setTermsError(data.error ?? 'Remove failed')
    }
    setTermsUploading(false)
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-zinc-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!template) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft size={14} />
            Templates
          </Link>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="mt-1 block w-full text-xl font-semibold text-zinc-900 bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none pb-0.5 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 pt-5">
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Section editor */}
      <SectionList sections={sections} onChange={handleSectionsChange} />

      {/* Terms & Conditions */}
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Terms &amp; Conditions</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Upload a PDF that applicants must review and sign before they can submit the form. Optional — if not set, no T&amp;C step appears.
        </p>

        {termsPdfPath ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-700 truncate flex-1">
              {termsPdfPath.split('/').pop()}
            </span>
            <button
              type="button"
              onClick={handleTermsRemove}
              disabled={termsUploading}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
            >
              <Trash2 size={13} />
              Remove
            </button>
            <button
              type="button"
              onClick={() => termsFileRef.current?.click()}
              disabled={termsUploading}
              className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-40 transition-colors"
            >
              <Upload size={13} />
              Replace
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => termsFileRef.current?.click()}
            disabled={termsUploading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-40 transition-colors"
          >
            <Upload size={13} />
            {termsUploading ? 'Uploading…' : 'Upload PDF'}
          </button>
        )}

        {termsError && <p className="text-xs text-red-500">{termsError}</p>}

        <input
          ref={termsFileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleTermsUpload}
        />
      </div>
    </div>
  )
}
