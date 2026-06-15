# Online Credit / COD Application Web App

**Product Requirements Document**

**Version:** 1.0  
**Status:** Draft — Ready for Implementation  
**Prepared for:** Claude Code  
**Date:** 2025-06-12

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [Application Architecture](#6-application-architecture)
7. [Feature Specifications](#7-feature-specifications)
8. [Email Notification Specifications](#8-email-notification-specifications)
9. [File Storage Architecture](#9-file-storage-architecture)
10. [Phase-Based Implementation Plan](#10-phase-based-implementation-plan)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Out of Scope (v1)](#12-out-of-scope-v1)

---

## 1. Project Overview

This application is a **multi-tenant, company-scoped web platform** that digitises the credit and COD (Cash on Delivery) application process for B2B businesses. Companies use the platform to create customised application forms, send them to prospective customers (applicants), track completion progress, review submissions, and action approvals or rejections — all within a single managed workflow.

The platform replaces paper-based or generic-form-tool workflows with a purpose-built system that includes automated email notifications, secure tokenised links, real-time tracking, and a structured review lifecycle.

---

## 2. Goals & Success Metrics

### Goals

- Enable companies to digitise their credit/COD onboarding process end-to-end.
- Provide real-time visibility into application status across the pipeline.
- Reduce manual follow-up effort through automated email triggers.
- Ensure secure, company-scoped access to all data and documents.

### Success Metrics (v1)

| Metric | Target |
|--------|--------|
| Applications sent and tracked end-to-end | 100% traceable |
| Email delivery rate (via AWS SES) | ≥ 98% |
| Time to first submission (after send) | Measurable per application |
| Form completion on mobile | Fully functional (responsive) |
| Row-level data isolation between companies | 100% enforced via RLS |

---

## 3. User Roles & Permissions

### Entity Hierarchy

```
Company (top-level tenant)
  └── Users (one or more per company)
       └── Applications (scoped to company)
            └── Submissions, Files, Status History
```

### Role Definitions (v1)

| Role | Description |
|------|-------------|
| **Company User** | Authenticated employee of a company. Can perform all actions within their company scope. No admin/viewer split in v1. |
| **Applicant** | External recipient of an application link. Not an authenticated user. Accesses forms via secure token only. |
| **System/Platform Admin** | Out of scope for v1. Companies and users are seeded manually. |

### Permissions Matrix (v1)

| Action | Company User | Applicant |
|--------|-------------|-----------|
| Manage form templates | ✅ | ❌ |
| Send applications | ✅ | ❌ |
| View applications (own company) | ✅ | ❌ |
| Complete form (via token link) | ❌ | ✅ |
| Review & action submissions | ✅ | ❌ |
| Set renewal dates | ✅ | ❌ |
| View files (own company) | ✅ | ❌ |

---

## 4. Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Framework | **Next.js 14+ (App Router)** | Full-stack React with server components, API routes, and edge functions in one project. App Router enables fine-grained server/client boundary control. |
| Authentication | **Better Auth** | Drop-in auth library supporting email/password with session management. Integrates cleanly with Next.js and Supabase. |
| Styling | **Tailwind CSS** | Utility-first CSS for rapid, consistent UI development. Works well with Next.js server components. |
| Database | **Supabase (PostgreSQL)** | Managed Postgres with built-in Row Level Security, real-time subscriptions, and edge functions. Simplifies multi-tenancy. |
| File Storage | **Supabase Storage** | Co-located with the database; supports bucket-level and object-level access policies tied to RLS. |
| Email | **AWS SES** | Scalable, deliverable transactional email. Supports custom domains and template-based sending. |
| Language | **TypeScript** | Type safety across the full stack (Next.js, Supabase client, API routes). |
| Scheduled Jobs | **Supabase Edge Functions + pg_cron** | For renewal date reminders. pg_cron triggers SQL, Edge Functions call AWS SES. |
| Signature Capture | **react-signature-canvas** or **signature_pad** | Lightweight canvas-based signature capture for the form experience. |

---

## 5. Database Schema

### Overview of Tables

```
-- Better Auth managed (auto-created via CLI) --
user
session
account
verification

-- Application tables --
companies
user_profiles           (links Better Auth users to companies)
form_templates
form_template_fields
applications
application_field_responses
application_files
application_status_history
```

---

### Table: `companies`

```sql
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Better Auth Managed Tables

Better Auth auto-creates and manages four core tables. **Do not create these manually** — run `npx auth@latest migrate` (or `npx auth@latest generate` for Drizzle/Prisma). The schema below documents what Better Auth creates so foreign keys and RLS policies can reference them correctly.

#### Table: `user`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | Primary key (UUID string, generated by Better Auth) |
| `name` | `text` | Display name |
| `email` | `text` | Unique |
| `emailVerified` | `boolean` | Whether the email address has been verified |
| `image` | `text` | Avatar URL (nullable) |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

#### Table: `session`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | Primary key |
| `userId` | `text` | FK → `user.id` ON DELETE CASCADE |
| `token` | `text` | Unique session token |
| `expiresAt` | `timestamptz` | |
| `ipAddress` | `text` | Nullable |
| `userAgent` | `text` | Nullable |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

#### Table: `account`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | Primary key |
| `userId` | `text` | FK → `user.id` ON DELETE CASCADE |
| `accountId` | `text` | Provider account ID; equals `userId` for credential logins |
| `providerId` | `text` | e.g. `"credential"` for email/password |
| `accessToken` | `text` | Nullable |
| `refreshToken` | `text` | Nullable |
| `accessTokenExpiresAt` | `timestamptz` | Nullable |
| `refreshTokenExpiresAt` | `timestamptz` | Nullable |
| `scope` | `text` | Nullable |
| `idToken` | `text` | Nullable |
| `password` | `text` | Hashed password for credential logins (nullable) |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

#### Table: `verification`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | Primary key |
| `identifier` | `text` | e.g. the email address being verified |
| `value` | `text` | Verification code or token |
| `expiresAt` | `timestamptz` | |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

---

### Table: `user_profiles`

Links Better Auth users to companies. All RLS policies join through this table to resolve `company_id`.

```sql
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,  -- References user.id (text in Better Auth)
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Implementation note:** Use a `databaseHooks.user.create.after` hook in your Better Auth config to insert a `user_profiles` row whenever a new user is created. Better Auth's `user.id` is a `text` type — always reference it as `TEXT` in foreign keys.

---

### Table: `form_templates`

```sql
CREATE TABLE form_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                        -- e.g. "Credit Application - Standard"
  type         TEXT NOT NULL CHECK (type IN ('credit', 'cod')),
  is_default   BOOLEAN NOT NULL DEFAULT false,       -- true for system-seeded templates
  created_by   TEXT NOT NULL,                        -- Better Auth user.id
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Table: `form_template_fields`

```sql
CREATE TABLE form_template_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  field_key       TEXT NOT NULL,                     -- Machine identifier, e.g. "business_name"
  label           TEXT NOT NULL,                     -- Display label
  field_type      TEXT NOT NULL CHECK (field_type IN (
                    'text_single', 'text_multi', 'date', 'number', 'signature', 'file_pdf'
                  )),
  is_required     BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  config          JSONB,                             -- Optional: placeholder, validation hints
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Table: `applications`

```sql
CREATE TABLE applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES form_templates(id),
  sent_by_user_id     TEXT NOT NULL,                 -- Better Auth user.id
  applicant_company   TEXT NOT NULL,
  applicant_email     TEXT NOT NULL,
  token               TEXT NOT NULL UNIQUE,          -- Secure random token for public link
  token_expires_at    TIMESTAMPTZ,                   -- NULL = no expiry, else 30 days default
  status              TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
                        'sent', 'in_progress', 'submitted', 'approved', 'rejected', 'incomplete'
                      )),
  completion_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at    TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         TEXT,                          -- Better Auth user.id
  rejection_reason    TEXT,
  renewal_date        DATE,
  renewal_reminded_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_company_id ON applications(company_id);
CREATE INDEX idx_applications_token ON applications(token);
CREATE INDEX idx_applications_status ON applications(status);
```

---

### Table: `application_field_responses`

```sql
CREATE TABLE application_field_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_id        UUID NOT NULL REFERENCES form_template_fields(id),
  value_text      TEXT,          -- For text, date, number fields
  value_json      JSONB,         -- For signature data (base64 PNG stored as JSON)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, field_id)
);
```

---

### Table: `application_files`

```sql
CREATE TABLE application_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_id        UUID NOT NULL REFERENCES form_template_fields(id),
  storage_path    TEXT NOT NULL,    -- Supabase Storage object path
  filename        TEXT NOT NULL,    -- Original filename
  mime_type       TEXT NOT NULL,
  size_bytes      INTEGER,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Table: `application_status_history`

```sql
CREATE TABLE application_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  changed_by      TEXT,           -- Better Auth user.id (NULL for system transitions)
  notes           TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Row Level Security (RLS) Policies

> All policies assume a helper function that resolves `company_id` for the authenticated user.

```sql
-- Helper function: get company_id of the authenticated user
CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_profiles WHERE user_id = auth.uid()::TEXT
$$ LANGUAGE sql SECURITY DEFINER;
```

> **Note:** `auth.uid()` returns the Supabase auth UID. Better Auth sessions must be configured to set the Supabase JWT claim with the user ID, or a service-role key is used server-side (recommended for Next.js API routes).

```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_field_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;

-- companies: users can only see their own company
CREATE POLICY "company_isolation" ON companies
  FOR SELECT USING (id = auth_company_id());

-- form_templates: company-scoped
CREATE POLICY "templates_company_scope" ON form_templates
  FOR ALL USING (company_id = auth_company_id());

-- form_template_fields: via template
CREATE POLICY "fields_company_scope" ON form_template_fields
  FOR ALL USING (
    template_id IN (
      SELECT id FROM form_templates WHERE company_id = auth_company_id()
    )
  );

-- applications: company-scoped
CREATE POLICY "applications_company_scope" ON applications
  FOR ALL USING (company_id = auth_company_id());

-- application_field_responses: via application
CREATE POLICY "responses_company_scope" ON application_field_responses
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );

-- application_files: via application
CREATE POLICY "files_company_scope" ON application_files
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );

-- application_status_history: via application
CREATE POLICY "history_company_scope" ON application_status_history
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE company_id = auth_company_id()
    )
  );
```

> **Implementation note:** Next.js API routes should use the Supabase **service role key** server-side (never exposed to the client) to bypass RLS where needed (e.g. applicant token validation), and manually enforce company-scoping in application logic. The Supabase client in the browser uses the **anon key** with RLS enforced.

---

## 6. Application Architecture

### Next.js App Router Folder Structure

```
/
├── app/
│   ├── layout.tsx                        # Root layout (fonts, global providers)
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                  # Login page
│   │   └── layout.tsx                    # Auth layout (no sidebar)
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Dashboard layout (sidebar, auth guard)
│   │   ├── templates/
│   │   │   ├── page.tsx                  # List all form templates
│   │   │   ├── [templateId]/
│   │   │   │   └── page.tsx              # Edit a template (field builder)
│   │   │   └── new/
│   │   │       └── page.tsx              # Create new template
│   │   ├── send/
│   │   │   └── page.tsx                  # Send application form
│   │   ├── applications/
│   │   │   ├── incomplete/
│   │   │   │   └── page.tsx              # Incomplete Applications view
│   │   │   ├── submitted/
│   │   │   │   ├── page.tsx              # Submitted Applications (awaiting review)
│   │   │   │   └── [applicationId]/
│   │   │   │       └── page.tsx          # Review a single submission
│   │   │   ├── approved/
│   │   │   │   └── page.tsx              # Approved Applications
│   │   │   └── rejected/
│   │   │       └── page.tsx              # Rejected Applications
│   │   └── page.tsx                      # Dashboard home (redirect or overview)
│   ├── apply/
│   │   └── [token]/
│   │       ├── page.tsx                  # Recipient-facing form (public, token-gated)
│   │       └── preview/
│   │           └── page.tsx              # Pre-submit preview (public, token-gated)
│   └── api/
│       ├── auth/
│       │   └── [...all]/
│       │       └── route.ts              # Better Auth handler
│       ├── templates/
│       │   ├── route.ts                  # GET all, POST create
│       │   └── [templateId]/
│       │       └── route.ts              # GET, PUT, DELETE
│       ├── applications/
│       │   ├── route.ts                  # GET list (with status filter), POST send
│       │   └── [applicationId]/
│       │       ├── route.ts              # GET single, PATCH status
│       │       └── files/
│       │           └── route.ts          # GET presigned URLs for files
│       ├── apply/
│       │   └── [token]/
│       │       ├── route.ts              # GET: validate token, return form schema + saved progress
│       │       ├── progress/
│       │       │   └── route.ts          # POST: save field responses, update completion_pct
│       │       └── submit/
│       │           └── route.ts          # POST: finalise submission
│       └── cron/
│           └── renewal-reminders/
│               └── route.ts             # GET (cron-triggered): send renewal reminder emails
├── components/
│   ├── ui/                               # Reusable UI primitives (buttons, inputs, badges)
│   ├── form-builder/
│   │   ├── FieldList.tsx                 # Drag-to-reorder field list
│   │   ├── FieldEditor.tsx               # Edit a single field
│   │   └── FieldTypeSelector.tsx
│   ├── form-renderer/
│   │   ├── FormRenderer.tsx              # Renders form fields dynamically (recipient view)
│   │   ├── SignatureField.tsx            # Canvas-based signature capture
│   │   ├── FileUploadField.tsx           # PDF upload with preview
│   │   └── FieldWrapper.tsx
│   ├── applications/
│   │   ├── ApplicationTable.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ReviewPanel.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       └── Topbar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client (anon key)
│   │   └── server.ts                     # Server Supabase client (service role)
│   ├── auth/
│   │   └── better-auth.ts                # Better Auth config
│   ├── email/
│   │   └── ses.ts                        # AWS SES send wrapper
│   ├── tokens.ts                          # Token generation utilities
│   └── completion.ts                      # Completion percentage calculation
├── types/
│   └── index.ts                           # Shared TypeScript types
├── middleware.ts                           # Auth guard for (dashboard) routes
└── supabase/
    ├── migrations/                         # SQL migration files
    └── seed/                               # Seed scripts for default templates
```

---

### Key Architecture Decisions

| Decision | Approach |
|----------|----------|
| Auth guard | `middleware.ts` protects all `/dashboard/*` routes using Better Auth session check |
| Public form routes | `/apply/[token]/*` — no auth required; token validated server-side |
| API routes | All API routes are server-only; use service role Supabase client |
| Realtime | Supabase Realtime subscriptions for `last_accessed_at` and `completion_pct` updates on the Incomplete Applications page |
| Server vs Client | Server components for data-fetching pages; Client components for interactive form builder, signature capture, file upload |

---

## 7. Feature Specifications

### 7.1 Form Template Management

#### Overview
Users can create and customise form templates saved per company. Two system default templates are seeded on company creation.

#### Functional Requirements

**FR-T-01:** The system seeds two default form templates per company on creation: "Credit Application" and "COD Application". These are marked `is_default = true` and cannot be deleted, only duplicated.

**FR-T-02:** Users can create a new template by duplicating an existing one (including the default) and giving it a custom name.

**FR-T-03:** The template editor presents a list of fields in display order. Users can:
- Add a new field (select type, set label, mark required/optional)
- Edit an existing field's label, type, or required status
- Remove a field (with confirmation)
- Reorder fields via drag-and-drop

**FR-T-04:** Supported field types:

| Type Key | UI Label | Input |
|----------|----------|-------|
| `text_single` | Short Text | Single-line input |
| `text_multi` | Long Text | Multi-line textarea |
| `date` | Date | Date picker |
| `number` | Number | Numeric input |
| `signature` | Signature | Canvas-based free-hand |
| `file_pdf` | PDF Upload | File input (PDF only) |

**FR-T-05:** Template changes auto-save or are saved on explicit "Save" action. Unsaved changes display a visual indicator.

**FR-T-06:** Templates are shared across all users within the same company (company_id scoped).

**FR-T-07:** Deleting a non-default template is permitted if no active (non-submitted) applications reference it. If active applications exist, deletion is blocked with an error message.

#### Edge Cases
- If a template field is removed after an application was sent, existing application responses for that field are preserved but the field is no longer rendered in the review UI (display with a "removed field" label).
- Field `field_key` values must be unique within a template. Auto-generate from label (slugified) and allow user override.

---

### 7.2 Send Application

#### Overview
Users select a template, enter applicant details, and send one or more application invitations.

#### Functional Requirements

**FR-S-01:** The Send page presents:
- Template selector (dropdown of company's templates, grouped by type)
- One or more applicant rows, each requiring:
  - Applicant company name (text)
  - Applicant email address (text, validated)
- "Add Another Applicant" button to add additional rows
- "Send" button

**FR-S-02:** On submission, for each applicant:
1. A cryptographically random token is generated (`crypto.randomUUID()` or equivalent).
2. A new `applications` record is created with status `sent` and `token_expires_at = now() + 30 days`.
3. An email is sent via AWS SES containing the unique application link.
4. The application appears immediately in the Incomplete Applications view.

**FR-S-03:** The unique application link format: `https://<domain>/apply/<token>`

**FR-S-04:** Token generation must use a secure random source (minimum 128 bits of entropy). UUIDs v4 are acceptable.

**FR-S-05:** Multiple applicants can be sent in one action. Each receives their own independent application record and unique token.

**FR-S-06:** Send confirmation is shown in-app after successful dispatch (success toast per applicant).

#### Edge Cases
- If email delivery fails for one applicant (SES bounce/error), the application record is still created but flagged. The UI shows the send error and provides a "Resend" option.
- Duplicate emails in a single send batch: warn the user but allow.
- If the same email has previously received an application from this company, warn but allow duplicate sends.

---

### 7.3 Incomplete Applications Tracking

#### Overview
A real-time view of all sent applications that have not yet been submitted.

#### Functional Requirements

**FR-I-01:** The Incomplete Applications section displays all applications with status `sent` or `in_progress`, sorted by `sent_at` descending.

**FR-I-02:** For each application, display:
- Applicant company name
- Applicant email
- Template name
- Sent date
- Last accessed date (from `last_accessed_at`; shows "Not yet opened" if null)
- Completion percentage (from `completion_pct`)
- Status badge (`Sent` / `In Progress`)

**FR-I-03:** `last_accessed_at` is updated server-side every time the applicant loads the form page (even without making changes).

**FR-I-04:** `completion_pct` is calculated as:
```
(count of required fields with a saved response / total required fields) * 100
```
Rounded to nearest integer. Updated each time the applicant saves progress.

**FR-I-05:** The page uses Supabase Realtime to listen for changes to `last_accessed_at` and `completion_pct` for the company's open applications, updating the table without a full page refresh.

**FR-I-06:** Users can click on an application row to see a detail panel with full applicant info and a link to resend the invitation email.

**FR-I-07:** "Resend" triggers a new email to the same applicant with the same token link (not a new token).

#### Edge Cases
- Applications with expired tokens appear with an "Expired" badge. Users can extend the token expiry or resend (which resets expiry).

---

### 7.4 Recipient-Facing Form Experience

#### Overview
A public, token-gated form that applicants access via email link. Optimised for mobile.

#### Functional Requirements

**FR-R-01:** On load of `/apply/[token]`:
1. Validate token exists in database.
2. Check token has not expired (`token_expires_at IS NULL OR token_expires_at > now()`).
3. Check application status is `sent` or `in_progress` or `incomplete`.
4. If invalid/expired: show branded error page ("This link is invalid or has expired. Please contact [company name].").
5. If valid: update `last_accessed_at = now()` and set status to `in_progress` if currently `sent`.

**FR-R-02:** The form renders all fields from the application's template in display order, pre-populated with any previously saved responses.

**FR-R-03:** Each field type renders as follows:
- `text_single`: `<input type="text">`
- `text_multi`: `<textarea>`
- `date`: Date picker (native or library-based)
- `number`: `<input type="number">`
- `signature`: Canvas-based signature pad with "Clear" option. On save, exports as base64 PNG stored in `value_json`.
- `file_pdf`: File input accepting PDF only. Uploaded immediately to Supabase Storage on selection; stored path saved in `application_files`.

**FR-R-04:** Progress is saved automatically (debounced, 1–2 seconds after last change) by calling `POST /api/apply/[token]/progress` with the current field values. On save, `completion_pct` is recalculated and stored.

**FR-R-05:** A progress indicator (percentage or progress bar) is shown at the top of the form.

**FR-R-06:** Required fields are marked with a visual indicator (asterisk). The "Review & Submit" button is enabled only when all required fields have responses.

**FR-R-07:** Clicking "Review & Submit" navigates to `/apply/[token]/preview`, which renders a read-only view of all completed fields (including the signature image and PDF file names).

**FR-R-08:** On the preview page, the applicant can click "Back to Edit" or "Submit Application".

**FR-R-09:** Clicking "Submit Application" calls `POST /api/apply/[token]/submit`, which:
1. Validates token and required fields are complete.
2. Sets `applications.status = 'submitted'` and `submitted_at = now()`.
3. Triggers notification email to the company user(s) who sent the application.
4. Redirects the applicant to a thank-you/confirmation page.

#### Edge Cases
- If the applicant tries to access the form after submission, show a "Thank you, your application has been submitted" page.
- If the applicant tries to access a `rejected` or `approved` application, show the appropriate status message.
- Large PDF uploads (>10 MB): return a clear error message.
- Signature field: if the canvas is submitted blank (all white), treat as not filled.

---

### 7.5 Post-Submission Review Workflow

#### Overview
Internal users review submitted applications and take action.

#### Functional Requirements

**FR-V-01:** The Submitted Applications section displays all applications with status `submitted`, sorted by `submitted_at` descending.

**FR-V-02:** For each application in the list, display:
- Applicant company name
- Applicant email
- Template type (Credit / COD)
- Submitted date

**FR-V-03:** Clicking an application opens the full review view, which shows all field responses rendered read-only, including:
- Signature: displayed as image
- PDF uploads: listed with download links (signed Supabase Storage URLs, valid 1 hour)
- All text/date/number responses

**FR-V-04:** At the bottom of the review view, the user can select an action:
- **Approve** — one-click with optional notes
- **Reject** — requires a mandatory rejection reason text input before confirming
- **Mark Incomplete** — requires optional notes

**FR-V-05:** On action confirmation:
1. `applications.status` is updated to `approved`, `rejected`, or `incomplete`.
2. `reviewed_at` and `reviewed_by` are set.
3. `rejection_reason` is set (for rejections).
4. A record is inserted into `application_status_history`.
5. The appropriate email is sent to the applicant.
6. The application is removed from the Submitted view.

#### Edge Cases
- Only one user can action a submission at a time. If two users open the same submission simultaneously, the second action attempt should return a conflict error (check `reviewed_at IS NULL` before actioning).
- Once actioned, the application cannot be re-actioned in v1 (no undo).

---

### 7.6 Status-Based Routing

#### Approved Applications

**FR-A-01:** The Approved Applications section lists all applications with `status = 'approved'`, sorted by `reviewed_at` descending.

**FR-A-02:** Columns: Applicant Company, Applicant Email, Approval Date, Renewal Date (editable inline or via modal), Days Until Renewal.

**FR-A-03:** Users can set or update the renewal date for any approved application. When saved, `applications.renewal_date` is updated.

**FR-A-04:** When the renewal date is reached (evaluated by scheduled job), a reminder email is sent to all users of the company. `renewal_reminded_at` is set to prevent duplicate reminders.

#### Rejected Applications

**FR-J-01:** The Rejected Applications section lists all applications with `status = 'rejected'`, sorted by `reviewed_at` descending.

**FR-J-02:** Columns: Applicant Company, Applicant Email, Rejection Date, Rejection Reason.

**FR-J-03:** Rejection reason is displayed in full (expandable if long).

#### Incomplete (Returned) Applications

**FR-IC-01:** Applications marked `incomplete` by the reviewer return to the Incomplete Applications view (same as sent/in-progress).

**FR-IC-02:** The original token link remains valid (expiry is reset to `now() + 30 days`).

**FR-IC-03:** The applicant receives an email prompting them to revisit the form. Their previously entered data is preserved.

---

## 8. Email Notification Specifications

### Configuration

- **From address:** Configurable per company (e.g. `noreply@<company-domain>.com`) or platform default.
- **AWS SES region:** Configurable via environment variable.
- **All email sending** occurs server-side via API routes or Edge Functions.

---

### Email 1: Application Sent (to Applicant)

**Trigger:** `POST /api/applications` — on successful application creation.  
**Recipient:** `applicant_email`  
**Subject:** `[Company Name] — Your [Credit/COD] Application`

**Body:**
```
Hi [Applicant Company Name],

[Sending Company Name] has sent you a [Credit / COD] application form to complete.

Please click the link below to access your form:

[Complete Your Application → https://<domain>/apply/<token>]

This link will expire on [token_expires_at formatted date].

If you have any questions, please contact [sending user's email].

Regards,
[Sending Company Name]
```

---

### Email 2: Application Submitted (to Internal User)

**Trigger:** `POST /api/apply/[token]/submit` — on successful submission.  
**Recipient:** All users in the company (via `user_profiles` join).  
**Subject:** `New Application Submitted — [Applicant Company Name]`

**Body:**
```
Hi Team,

A [Credit / COD] application from [Applicant Company Name] ([Applicant Email]) has been submitted and is ready for review.

[Review Application → https://<domain>/dashboard/applications/submitted/<application_id>]

Submitted at: [submitted_at formatted]

Regards,
[Platform Name]
```

---

### Email 3: Application Approved (to Applicant)

**Trigger:** `PATCH /api/applications/[applicationId]` with `status: 'approved'`.  
**Recipient:** `applicant_email`  
**Subject:** `Your Application Has Been Approved — [Company Name]`

**Body:**
```
Hi [Applicant Company Name],

We're pleased to inform you that your [Credit / COD] application submitted to [Company Name] has been approved.

If you have any questions, please reach out to us directly.

Regards,
[Company Name]
```

---

### Email 4: Application Rejected (to Applicant)

**Trigger:** `PATCH /api/applications/[applicationId]` with `status: 'rejected'`.  
**Recipient:** `applicant_email`  
**Subject:** `Regarding Your Application — [Company Name]`

**Body:**
```
Hi [Applicant Company Name],

Thank you for submitting your [Credit / COD] application to [Company Name].

After review, we are unable to approve your application at this time.

Reason: [rejection_reason]

If you would like to discuss this further, please contact us directly.

Regards,
[Company Name]
```

---

### Email 5: Application Marked Incomplete (to Applicant)

**Trigger:** `PATCH /api/applications/[applicationId]` with `status: 'incomplete'`.  
**Recipient:** `applicant_email`  
**Subject:** `Action Required: Your Application Needs Attention — [Company Name]`

**Body:**
```
Hi [Applicant Company Name],

Your [Credit / COD] application submitted to [Company Name] requires some additional information or corrections before it can be processed.

Please revisit your application using the link below:

[Continue Your Application → https://<domain>/apply/<token>]

If you have any questions, please contact us.

Regards,
[Company Name]
```

---

### Email 6: Renewal Date Reminder (to Internal Users)

**Trigger:** Scheduled job (daily) — fires when `renewal_date = CURRENT_DATE` and `renewal_reminded_at IS NULL`.  
**Recipient:** All users in the company.  
**Subject:** `Renewal Reminder — [Applicant Company Name]`

**Body:**
```
Hi Team,

This is a reminder that the credit/COD account for [Applicant Company Name] is due for renewal today ([renewal_date formatted]).

[View Application → https://<domain>/dashboard/applications/approved/<application_id>]

Please review and take appropriate action.

Regards,
[Platform Name]
```

---

## 9. File Storage Architecture

### Supabase Storage Bucket Configuration

```
Bucket name: application-files
Public access: DISABLED (private bucket)
```

### Object Path Convention

```
{company_id}/{application_id}/{field_id}/{filename}
```

Example:
```
c7f1d2a0-1234-5678-abcd-000000000001/
  app-9999/
    field-sig-001/
      signature.png
    field-pdf-002/
      tax_certificate.pdf
```

### Access Control

- **Upload:** API route (`POST /api/apply/[token]/progress`) uploads files server-side using the service role key after token validation.
- **Download:** Authenticated users request a signed URL via `GET /api/applications/[applicationId]/files` which verifies company membership and returns a 1-hour signed URL per file.
- **No direct browser-to-storage upload** for file fields (prevents bypassing company scope checks).

### Storage RLS Policy (additional layer)

```sql
-- Supabase Storage policy: only allow access to files under company's prefix
CREATE POLICY "company_file_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'application-files' AND
    (storage.foldername(name))[1] = auth_company_id()::TEXT
  );
```

### File Size Limits

| File Type | Max Size |
|-----------|----------|
| PDF upload | 10 MB |
| Signature PNG (auto-generated) | 500 KB |

---

## 10. Phase-Based Implementation Plan

> Each phase is independently shippable and should be committed and tested before proceeding to the next.

---

### Phase 1: Project Setup, Auth, Database, Company/User Model

**Goal:** Working Next.js app with authentication and database connectivity.

**Tasks:**

1. Initialise Next.js 14 project with TypeScript and Tailwind CSS.
2. Configure Supabase project:
   - Create all tables and indexes (run migrations in `/supabase/migrations/`).
   - Enable RLS on all tables.
   - Apply all RLS policies.
   - Create `auth_company_id()` helper function.
3. Integrate Better Auth:
   - Install and configure Better Auth for email/password login.
   - Set up `/api/auth/[...all]/route.ts`.
   - Create `user_profiles` table integration.
4. Create `middleware.ts` to protect `/(dashboard)` routes.
5. Build login page UI (`/login`).
6. Seed one test company and two users in the database.
7. Build dashboard shell: sidebar with navigation links, topbar with user info and logout.
8. Verify: users can log in, see the dashboard shell, and are scoped to their company.

**Deliverable:** Authenticated dashboard with empty sections and DB connectivity confirmed.

---

### Phase 2: Form Template Management

**Goal:** Users can view, create, and customise form templates.

**Tasks:**

1. Seed default "Credit Application" and "COD Application" templates with a standard field set for both types (to be defined in `/supabase/seed/`).
2. Build Templates list page: list all company templates, show type badge, created date.
3. Build Template Editor page:
   - Render existing fields with type, label, required toggle.
   - Add field: select type, enter label, mark required.
   - Reorder fields via drag-and-drop (use `@dnd-kit/core` or `react-beautiful-dnd`).
   - Delete field (with guard for default templates).
   - Save template.
4. Build "New Template" flow: duplicate a template, rename it.
5. Implement API routes:
   - `GET /api/templates` — list company templates.
   - `POST /api/templates` — create new.
   - `GET /api/templates/[templateId]` — fetch with fields.
   - `PUT /api/templates/[templateId]` — update template and fields.
   - `DELETE /api/templates/[templateId]` — delete with guard.
6. Validate all CRUD actions are company-scoped.

**Deliverable:** Users can create, view, and edit form templates with custom fields.

---

### Phase 3: Send Out Functionality & Tokenised Links

**Goal:** Users can send application invitations to applicants.

**Tasks:**

1. Build Send Application page:
   - Template selector.
   - Dynamic applicant rows (company name + email).
   - "Add Another" button.
   - Send button with loading state.
2. Implement token generation utility (`lib/tokens.ts`):
   - `generateToken()` — returns `crypto.randomUUID()`.
   - Token expiry: `now() + 30 days`.
3. Implement `POST /api/applications`:
   - For each applicant: generate token, create `applications` record.
   - Trigger Email 1 (Application Sent) via AWS SES.
4. Configure AWS SES:
   - Install `@aws-sdk/client-ses`.
   - Create `lib/email/ses.ts` with `sendEmail(to, subject, body)` wrapper.
   - Configure SES credentials via environment variables.
5. Verify: applications appear in DB, email received with correct link.

**Deliverable:** Applications can be sent; applicants receive email with unique link.

---

### Phase 4: Recipient-Facing Form Experience

**Goal:** Applicants can access, complete, and submit their form.

**Tasks:**

1. Build `/apply/[token]/page.tsx`:
   - Token validation (API call on load).
   - Error page for invalid/expired tokens.
   - Render `FormRenderer` component with template fields.
   - Auto-save debounced progress (`POST /api/apply/[token]/progress`).
   - Progress bar.
   - "Review & Submit" button.
2. Build `FormRenderer` and all field components:
   - `SignatureField` (canvas + clear button + base64 export).
   - `FileUploadField` (PDF only, upload on select, show filename).
   - Standard input fields.
3. Build `/apply/[token]/preview/page.tsx`:
   - Read-only render of all responses.
   - "Back to Edit" and "Submit Application" buttons.
4. Implement API routes:
   - `GET /api/apply/[token]` — validate token, return form schema + saved responses.
   - `POST /api/apply/[token]/progress` — upsert field responses, update `completion_pct`, update `last_accessed_at`.
   - `POST /api/apply/[token]/submit` — finalise submission.
5. Build thank-you/confirmation page shown post-submit.
6. Ensure full mobile responsiveness across all recipient pages.

**Deliverable:** Applicants can complete and submit the form end-to-end.

---

### Phase 5: Submission Handling & User Review Workflow

**Goal:** Internal users can review submissions and take action.

**Tasks:**

1. Build Submitted Applications list page:
   - List all `status = 'submitted'` applications.
   - Sort by `submitted_at` descending.
2. Build Submission Review page (`/applications/submitted/[applicationId]`):
   - Render all field responses read-only.
   - Render signatures as images.
   - Render PDF file download links (via signed URLs from `GET /api/applications/[applicationId]/files`).
   - Action panel: Approve / Reject (with reason) / Mark Incomplete.
3. Implement `PATCH /api/applications/[applicationId]`:
   - Validate requesting user is in same company.
   - Update status, `reviewed_at`, `reviewed_by`, `rejection_reason`.
   - Insert `application_status_history` record.
   - Trigger appropriate email (Email 3, 4, or 5).
4. Implement notification email sending logic (Emails 3, 4, 5).
5. Trigger Email 2 (submitted notification to users) from submit route (if not done in Phase 4).

**Deliverable:** Full review workflow: view, action, email triggers.

---

### Phase 6: Status Routing (Approved / Rejected / Incomplete) & Email Triggers

**Goal:** Actioned applications route to the correct section.

**Tasks:**

1. Build Approved Applications page:
   - List `status = 'approved'` applications.
   - Show renewal date column (editable inline with date picker).
   - Implement `PATCH /api/applications/[applicationId]` for `renewal_date` update.
2. Build Rejected Applications page:
   - List `status = 'rejected'` applications.
   - Show rejection reason.
3. Verify Incomplete routing:
   - Applications marked `incomplete` appear in Incomplete Applications view.
   - Token expiry is extended by 30 days when marked incomplete.
   - Applicant can re-access and update the form.
4. Verify all email triggers fire correctly for each status transition.

**Deliverable:** All three post-review sections functional with correct routing.

---

### Phase 7: Renewal Date Management & Automated Reminders

**Goal:** Automated renewal reminders sent on due date.

**Tasks:**

1. Create Supabase Edge Function `renewal-reminders`:
   - Query: `SELECT * FROM applications WHERE status = 'approved' AND renewal_date = CURRENT_DATE AND renewal_reminded_at IS NULL`.
   - For each result: send Email 6 to all company users.
   - Update `renewal_reminded_at = now()`.
2. Schedule Edge Function via pg_cron (daily at 07:00 UTC).
3. Alternatively, create `GET /api/cron/renewal-reminders` route secured by `CRON_SECRET` header, triggered by an external cron service (e.g. Vercel Cron or GitHub Actions).
4. Test: set a renewal_date to today, verify email received and `renewal_reminded_at` set.

**Deliverable:** Automated renewal reminders working end-to-end.

---

### Phase 8: Polish, RLS Hardening, Responsive Design, Testing

**Goal:** Production-ready application with no security gaps.

**Tasks:**

1. **RLS audit:** Verify every table has appropriate policies; test cross-company data isolation with two seeded companies.
2. **Token security audit:** Verify all public endpoints (`/api/apply/*`) validate token, expiry, and status correctly.
3. **Responsive design review:** Test all pages on mobile (375px, 390px widths). Focus on: form renderer, signature field, dashboard tables.
4. **Error handling:** Add error boundaries, toast notifications for API errors, form validation feedback.
5. **Loading states:** Skeletons or spinners on all async data loads.
6. **Empty states:** Friendly empty states for each application section.
7. **Performance:** Add `loading.tsx` files for all dashboard routes. Verify server components are used where possible.
8. **Realtime:** Implement Supabase Realtime for Incomplete Applications table (`last_accessed_at`, `completion_pct`).
9. **Environment variable documentation:** Produce `.env.example` with all required vars.
10. **End-to-end smoke test:** Full user journey (send → complete → review → approve → renewal reminder).

**Deliverable:** Production-ready, fully tested application.

---

## 11. Non-Functional Requirements

### Security

| Requirement | Implementation |
|-------------|----------------|
| Multi-tenancy isolation | Supabase RLS policies on all tables; `auth_company_id()` helper enforced server-side |
| Secure form tokens | `crypto.randomUUID()` — 128-bit entropy. Stored as unique index. |
| Token expiry | Default 30 days. Enforced server-side on every request. |
| File access | No public file URLs. All access via signed URLs (1-hour TTL). |
| API authentication | All dashboard API routes require valid Better Auth session. |
| Environment secrets | AWS credentials, SES config, Supabase keys in environment variables only. Never in source code. |
| Input validation | Zod or equivalent on all API route inputs. |

### Performance

| Requirement | Target |
|-------------|--------|
| Dashboard page load | < 2s (server-rendered) |
| Form load for applicant | < 1.5s |
| Auto-save response | Debounced 1–2s; non-blocking |
| File upload | Progress indicator shown; max 10MB |
| Realtime updates | < 500ms latency via Supabase Realtime |

### Scalability

- Database: Supabase managed Postgres scales horizontally via connection pooling (PgBouncer).
- Storage: Supabase Storage backed by S3-compatible object store.
- Email: AWS SES scales to millions of messages; no architectural bottleneck.
- Stateless Next.js API routes are horizontally scalable (deploy to Vercel or similar).

### Reliability

- Email failures: log failed sends to database; surface in UI as "Email delivery failed" with manual retry option.
- Cron failures: pg_cron or cron service should alert on missed executions. Idempotency enforced by `renewal_reminded_at IS NULL` check.

---

## 12. Out of Scope (v1)

The following features are explicitly excluded from v1 and should not be built or implied:

| Feature | Notes |
|---------|-------|
| Self-serve company registration | Companies and users are seeded/invited manually |
| Admin panel for platform management | No super-admin UI |
| Role-based permissions within a company | All users share equal access in v1 |
| Applicant accounts / login | Applicants access via token link only — no registration |
| Email template customisation UI | Email bodies are hardcoded templates in v1 |
| PDF generation of completed applications | No PDF export of submissions in v1 |
| Audit log UI | `application_status_history` is stored but not surfaced in a dedicated UI |
| Bulk actions | No bulk approve/reject in v1 |
| Webhook integrations | No outgoing webhooks in v1 |
| Two-factor authentication | Not required in v1 |
| White-labelling / custom domains | Single platform domain in v1 |
| Analytics / reporting dashboard | No metrics or reporting UI in v1 |
| In-app notifications | Email only; no in-app notification system |

---

*End of PRD — Version 1.0*
