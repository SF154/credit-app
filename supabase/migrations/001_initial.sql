-- ============================================================
-- Application tables (Better Auth manages user/session/account/verification)
-- ============================================================

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Links Better Auth users to companies.
-- user_id is TEXT because Better Auth user.id is a text UUID string.
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE form_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('credit', 'cod')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE form_template_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  field_key     TEXT NOT NULL,
  label         TEXT NOT NULL,
  field_type    TEXT NOT NULL CHECK (field_type IN (
                  'text_single', 'text_multi', 'date', 'number', 'signature', 'file_pdf'
                )),
  is_required   BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  config        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES form_templates(id),
  sent_by_user_id     TEXT NOT NULL,
  applicant_company   TEXT NOT NULL,
  applicant_email     TEXT NOT NULL,
  token               TEXT NOT NULL UNIQUE,
  token_expires_at    TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
                        'sent', 'in_progress', 'submitted', 'approved', 'rejected', 'incomplete'
                      )),
  completion_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at    TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         TEXT,
  rejection_reason    TEXT,
  renewal_date        DATE,
  renewal_reminded_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_company_id ON applications(company_id);
CREATE INDEX idx_applications_token ON applications(token);
CREATE INDEX idx_applications_status ON applications(status);

CREATE TABLE application_field_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_id       UUID NOT NULL REFERENCES form_template_fields(id),
  value_text     TEXT,
  value_json     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, field_id)
);

CREATE TABLE application_files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_id       UUID NOT NULL REFERENCES form_template_fields(id),
  storage_path   TEXT NOT NULL,
  filename       TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE application_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  changed_by     TEXT,
  notes          TEXT,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- NOTE: auth_company_id() uses Supabase's auth.uid() which only
-- works with Supabase Auth JWTs. Since we use Better Auth, all
-- server-side API routes use the service role key (bypassing RLS)
-- and enforce company scoping in application logic.
-- ============================================================

CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_profiles WHERE user_id = auth.uid()::TEXT
$$ LANGUAGE sql SECURITY DEFINER;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_field_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON companies
  FOR SELECT USING (id = auth_company_id());

CREATE POLICY "templates_company_scope" ON form_templates
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "fields_company_scope" ON form_template_fields
  FOR ALL USING (
    template_id IN (
      SELECT id FROM form_templates WHERE company_id = auth_company_id()
    )
  );

CREATE POLICY "applications_company_scope" ON applications
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "responses_company_scope" ON application_field_responses
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );

CREATE POLICY "files_company_scope" ON application_files
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );

CREATE POLICY "history_company_scope" ON application_status_history
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );
