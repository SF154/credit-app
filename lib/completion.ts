import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'

export function calculateCompletionPct(
  sections: FormTemplateSectionWithFields[],
  responses: ApplicationFieldResponse[],
  files: ApplicationFile[]
): number {
  const requiredFields = sections.flatMap((s) =>
    s.form_template_fields.filter((f) => f.is_required)
  )

  if (requiredFields.length === 0) return 100

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

  return Math.round((filled.length / requiredFields.length) * 100)
}
