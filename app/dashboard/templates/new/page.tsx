'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormTemplate } from '@/types'

interface TemplateOption {
  id: string
  name: string
  type: string
}

export default function NewTemplatePage() {
  const searchParams = useSearchParams()
  const fromId = searchParams.get('from')
  const router = useRouter()

  const [defaults, setDefaults] = useState<TemplateOption[]>([])
  const [custom, setCustom] = useState<TemplateOption[]>([])
  const [sourceId, setSourceId] = useState(fromId ?? '')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then(({ defaults: d, custom: c }) => {
        setDefaults(d)
        setCustom(c)
        setLoading(false)

        // Pre-fill name if source is known
        const all = [...d, ...c] as FormTemplate[]
        const source = all.find((t) => t.id === fromId)
        if (source) setName(`Copy of ${source.name}`)
      })
  }, [fromId])

  // When source selection changes, update name suggestion
  function handleSourceChange(id: string) {
    setSourceId(id)
    const all = [...defaults, ...custom]
    const source = all.find((t) => t.id === id)
    if (source) setName(`Copy of ${source.name}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sourceId) { setError('Please select a source template'); return }
    if (!name.trim()) { setError('Please enter a template name'); return }

    setSaving(true)
    setError(null)

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), sourceTemplateId: sourceId }),
    })

    if (res.ok) {
      const { id } = await res.json()
      router.push(`/dashboard/templates/${id}`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create template')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href="/dashboard/templates"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to Templates
      </Link>

      <h1 className="text-xl font-semibold text-zinc-900 mb-6">New Template</h1>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Source template */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Base template <span className="text-red-500">*</span>
            </label>
            <select
              value={sourceId}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Select a template to copy from…</option>
              {defaults.length > 0 && (
                <optgroup label="Default Templates">
                  {defaults.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type === 'credit' ? 'Credit' : 'COD'})
                    </option>
                  ))}
                </optgroup>
              )}
              {custom.length > 0 && (
                <optgroup label="My Templates">
                  {custom.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type === 'credit' ? 'Credit' : 'COD'})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Template name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Template name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Credit Application — Revised"
              className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Creating…' : 'Create Template'}
          </button>
        </form>
      )}
    </div>
  )
}
