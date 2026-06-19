import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'

export function calculateCompletionPct(
  sections: FormTemplateSectionWithFields[],
  responses: ApplicationFieldResponse[],
  files: ApplicationFile[],
  opts?: { termsRequired: boolean; termsSigned: boolean }
): number {
  const requiredFields = sections.flatMap((s) =>
    s.form_template_fields.filter((f) => f.is_required)
  )

  const termsWeight = opts?.termsRequired ? 1 : 0
  const totalRequired = requiredFields.length + termsWeight

  if (totalRequired === 0) return 100

  const responseMap = new Map(responses.map((r) => [r.field_id, r]))
  const fileFieldIds = new Set(files.map((f) => f.field_id))

  const filled = requiredFields.filter((field) => {
    if (field.field_type === 'file') return fileFieldIds.has(field.id)
    const response = responseMap.get(field.id)
    if (!response) return false
    if (response.value_text != null && response.value_text.trim() !== '') return true
    if (response.value_json != null) return true
    return false
  })

  const termsFilled = opts?.termsRequired && opts?.termsSigned ? 1 : 0

  return Math.round(((filled.length + termsFilled) / totalRequired) * 100)
}
