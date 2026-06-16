'use client'

import { useRef, useState } from 'react'
import type { ApplicationFile } from '@/types'

interface FileUploadFieldProps {
  token: string
  fieldId: string
  existingFile: ApplicationFile | null
  onUploaded: (file: ApplicationFile) => void
  disabled?: boolean
}

export default function FileUploadField({ token, fieldId, existingFile, onUploaded, disabled }: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<ApplicationFile | null>(existingFile)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const form = new FormData()
      form.append('fieldId', fieldId)
      form.append('file', file)

      const res = await fetch(`/api/apply/${token}/files`, { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
      }

      const uploaded: ApplicationFile = {
        id: data.fileId,
        application_id: '',
        field_id: fieldId,
        storage_path: data.storagePath,
        filename: data.filename,
        mime_type: 'application/pdf',
        size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      }
      setUploadedFile(uploaded)
      onUploaded(uploaded)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {uploadedFile ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">{uploadedFile.filename}</span>
          {!disabled && (
            <button
              type="button"
              className="ml-auto text-xs text-green-600 underline shrink-0"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading || disabled}
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload PDF
            </>
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
