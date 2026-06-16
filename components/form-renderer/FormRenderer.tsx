'use client'

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'
import FieldWrapper from './FieldWrapper'
import SignatureField from './SignatureField'
import FileUploadField from './FileUploadField'

type ResponseMap = Map<string, { valueText?: string; valueJson?: unknown }>
type FileMap = Map<string, ApplicationFile>

export interface FormRendererHandle {
  isAllRequiredFilled: () => boolean
  getResponses: () => { fieldId: string; valueText?: string; valueJson?: unknown }[]
}

interface FormRendererProps {
  sections: FormTemplateSectionWithFields[]
  savedResponses: ApplicationFieldResponse[]
  savedFiles: ApplicationFile[]
  token: string
  onChange: (responses: { fieldId: string; valueText?: string; valueJson?: unknown }[]) => void
  onFileUploaded?: (fieldId: string) => void
  disabled?: boolean
}

function initResponseMap(saved: ApplicationFieldResponse[]): ResponseMap {
  const map: ResponseMap = new Map()
  for (const r of saved) {
    map.set(r.field_id, {
      valueText: r.value_text ?? undefined,
      valueJson: r.value_json ?? undefined,
    })
  }
  return map
}

function initFileMap(saved: ApplicationFile[]): FileMap {
  const map: FileMap = new Map()
  for (const f of saved) map.set(f.field_id, f)
  return map
}

const FormRenderer = forwardRef<FormRendererHandle, FormRendererProps>(
  ({ sections, savedResponses, savedFiles, token, onChange, onFileUploaded, disabled }, ref) => {
    const responsesRef = useRef<ResponseMap>(initResponseMap(savedResponses))
    const filesRef = useRef<FileMap>(initFileMap(savedFiles))
    const [responses, setResponses] = useState<ResponseMap>(() => responsesRef.current)
    const [files, setFiles] = useState<FileMap>(() => filesRef.current)

    const requiredFieldIds = sections
      .flatMap((s) => s.form_template_fields.filter((f) => f.is_required).map((f) => f.id))

    useImperativeHandle(ref, () => ({
      isAllRequiredFilled: () => {
        return requiredFieldIds.every((id) => {
          const field = sections.flatMap((s) => s.form_template_fields).find((f) => f.id === id)
          if (!field) return false
          if (field.field_type === 'file') return filesRef.current.has(id)
          const r = responsesRef.current.get(id)
          if (!r) return false
          if (r.valueText != null && r.valueText.trim() !== '') return true
          if (r.valueJson != null) return true
          return false
        })
      },
      getResponses: () =>
        Array.from(responsesRef.current.entries()).map(([fieldId, val]) => ({ fieldId, ...val })),
    }))

    const updateResponse = useCallback(
      (fieldId: string, value: { valueText?: string; valueJson?: unknown }) => {
        const next = new Map(responsesRef.current)
        next.set(fieldId, value)
        responsesRef.current = next
        setResponses(new Map(next))
        onChange(Array.from(next.entries()).map(([id, v]) => ({ fieldId: id, ...v })))
      },
      [onChange]
    )

    const handleFileUploaded = useCallback((file: ApplicationFile) => {
      const next = new Map(filesRef.current).set(file.field_id, file)
      filesRef.current = next
      setFiles(new Map(next))
      onFileUploaded?.(file.field_id)
    }, [onFileUploaded])

    return (
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-2">
              {section.label}
            </h2>
            <div className="flex flex-col gap-5">
              {section.form_template_fields.map((field) => {
                const response = responses.get(field.id)
                const existingFile = files.get(field.id) ?? null

                return (
                  <FieldWrapper
                    key={field.id}
                    label={field.label}
                    required={field.is_required}
                  >
                    {field.field_type === 'text_single' && (
                      <input
                        type="text"
                        disabled={disabled}
                        value={response?.valueText ?? ''}
                        onChange={(e) => updateResponse(field.id, { valueText: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                        placeholder={field.config?.placeholder as string | undefined}
                      />
                    )}
                    {field.field_type === 'text_multi' && (
                      <textarea
                        disabled={disabled}
                        value={response?.valueText ?? ''}
                        onChange={(e) => updateResponse(field.id, { valueText: e.target.value })}
                        rows={4}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-y"
                        placeholder={field.config?.placeholder as string | undefined}
                      />
                    )}
                    {field.field_type === 'date' && (
                      <input
                        type="date"
                        disabled={disabled}
                        value={response?.valueText ?? ''}
                        onChange={(e) => updateResponse(field.id, { valueText: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      />
                    )}
                    {field.field_type === 'number' && (
                      <input
                        type="number"
                        disabled={disabled}
                        value={response?.valueText ?? ''}
                        onChange={(e) => updateResponse(field.id, { valueText: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      />
                    )}
                    {field.field_type === 'select' && (
                      <select
                        disabled={disabled}
                        value={response?.valueText ?? ''}
                        onChange={(e) => updateResponse(field.id, { valueText: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      >
                        <option value="">Select an option</option>
                        {((field.config?.options as string[]) ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.field_type === 'boolean' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={response?.valueText === 'true'}
                          onChange={(e) => updateResponse(field.id, { valueText: e.target.checked ? 'true' : 'false' })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Yes</span>
                      </label>
                    )}
                    {field.field_type === 'signature' && (
                      <SignatureField
                        value={(response?.valueJson as string) ?? null}
                        onChange={(base64) => updateResponse(field.id, { valueJson: base64 })}
                        disabled={disabled}
                      />
                    )}
                    {field.field_type === 'file' && (
                      <FileUploadField
                        token={token}
                        fieldId={field.id}
                        existingFile={existingFile}
                        onUploaded={handleFileUploaded}
                        disabled={disabled}
                      />
                    )}
                  </FieldWrapper>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }
)

FormRenderer.displayName = 'FormRenderer'
export default FormRenderer
