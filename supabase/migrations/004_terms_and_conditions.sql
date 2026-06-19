ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS terms_pdf_path TEXT;
ALTER TABLE applications  ADD COLUMN IF NOT EXISTS terms_signed_pdf_path TEXT;
