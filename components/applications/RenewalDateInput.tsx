'use client'

import { useState, useRef } from 'react'

interface RenewalDateInputProps {
  applicationId: string
  initialDate: string | null
}

export function RenewalDateInput({ applicationId, initialDate }: RenewalDateInputProps) {
  const [date, setDate] = useState(initialDate ?? '')
  const [saving, setSaving] = useState(false)
  const [hasError, setHasError] = useState(false)
  const prevDate = useRef(initialDate ?? '')

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const previous = prevDate.current
    setDate(value)
    setHasError(false)
    setSaving(true)

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renewalDate: value || null }),
      })
      if (!res.ok) throw new Error('Failed')
      prevDate.current = value
    } catch {
      setDate(previous)
      setHasError(true)
      setTimeout(() => setHasError(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <input
        type="date"
        value={date}
        onChange={handleChange}
        disabled={saving}
        className={`text-sm rounded px-1.5 py-0.5 border transition-colors disabled:opacity-50
          ${hasError ? 'border-red-400 bg-red-50' : 'border-transparent hover:border-zinc-300 focus:border-zinc-400'}
          focus:outline-none bg-transparent focus:bg-white`}
      />
      {saving && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 shrink-0" />
      )}
    </div>
  )
}
