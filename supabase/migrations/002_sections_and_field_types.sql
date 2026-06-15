-- Allow company_id to be NULL for platform-level default templates
ALTER TABLE form_templates ALTER COLUMN company_id DROP NOT NULL;

-- Sections table: groups fields within a template
CREATE TABLE form_template_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add section_id to fields; all fields must belong to a section
ALTER TABLE form_template_fields
  ADD COLUMN section_id UUID REFERENCES form_template_sections(id) ON DELETE CASCADE;

-- Expand field_type to include select, boolean, file (replaces file_pdf)
ALTER TABLE form_template_fields
  DROP CONSTRAINT form_template_fields_field_type_check;
ALTER TABLE form_template_fields
  ADD CONSTRAINT form_template_fields_field_type_check
  CHECK (field_type IN ('text_single','text_multi','date','number','signature','file','select','boolean'));

-- RLS for sections (scoped via template; defaults visible to all)
ALTER TABLE form_template_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections_company_scope" ON form_template_sections
  FOR ALL USING (
    template_id IN (
      SELECT id FROM form_templates
      WHERE company_id = auth_company_id() OR company_id IS NULL
    )
  );
