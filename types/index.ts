export type ApplicationStatus = 'sent' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'incomplete'
export type FieldType = 'text_single' | 'text_multi' | 'date' | 'number' | 'signature' | 'file' | 'select' | 'boolean'
export type FormType = 'credit' | 'cod'

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string // Better Auth text ID, not UUID
  company_id: string
  created_at: string
}

export interface FormTemplate {
  id: string
  company_id: string | null // NULL for platform-level defaults
  name: string
  type: FormType
  is_default: boolean
  created_by: string
  created_at: string
  updated_at: string
  terms_pdf_path: string | null
}

export interface FormTemplateSection {
  id: string
  template_id: string
  label: string
  display_order: number
  created_at: string
}

export interface FormTemplateField {
  id: string
  template_id: string
  section_id: string
  field_key: string
  label: string
  field_type: FieldType
  is_required: boolean
  display_order: number
  config: Record<string, unknown> | null
  created_at: string
}

export interface FormTemplateSectionWithFields extends FormTemplateSection {
  form_template_fields: FormTemplateField[]
}

export interface FormTemplateWithSections extends FormTemplate {
  form_template_sections: FormTemplateSectionWithFields[]
}

export interface Application {
  id: string
  company_id: string
  template_id: string
  sent_by_user_id: string
  applicant_company: string
  applicant_email: string
  token: string
  token_expires_at: string | null
  status: ApplicationStatus
  completion_pct: number
  sent_at: string
  last_accessed_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  renewal_date: string | null
  renewal_reminded_at: string | null
  terms_signed_pdf_path: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationFieldResponse {
  id: string
  application_id: string
  field_id: string
  value_text: string | null
  value_json: unknown | null
  created_at: string
  updated_at: string
}

export interface ApplicationFile {
  id: string
  application_id: string
  field_id: string
  storage_path: string
  filename: string
  mime_type: string
  size_bytes: number | null
  uploaded_at: string
}

export interface ApplicationStatusHistory {
  id: string
  application_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  notes: string | null
  changed_at: string
}

export interface ApplicationWithTemplate extends Application {
  form_templates: FormTemplate
}
