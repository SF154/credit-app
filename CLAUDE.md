# CLAUDE.md

We're building the app described in @SPEC.MD. Read that file for general architectural tasks or to double-check the exact database structure, tech stack or application architecture.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # development server (Turbopack, outputs to .next/dev)
npm run build    # production build (Turbopack by default)
npm run start    # production server
eslint .         # lint — use ESLint directly, NOT `next lint` (removed in v16)
```

## What this app is

A multi-tenant B2B web platform that digitises credit and COD (Cash on Delivery) application workflows. Companies send tokenised form links to applicants, track completion in real time, then review and action submissions.

Full product spec is in `SPEC.MD`.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) |
| Auth | Better Auth (email/password) — managed tables: `user`, `session`, `account`, `verification` |
| Database + Storage | Supabase (Postgres + RLS + Storage bucket `application-files`) |
| Email | AWS SES via `@aws-sdk/client-ses` |
| Styling | Tailwind CSS v4 |
| Validation | Zod v4 |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Signatures | `signature_pad` |

## Planned folder structure (from SPEC.MD)

```
app/
  (auth)/login/              # login page
  (dashboard)/               # auth-guarded; sidebar + topbar layout
    templates/               # form template CRUD + drag-and-drop field builder
    send/                    # send application invitations
    applications/incomplete|submitted|approved|rejected/
  apply/[token]/             # public, token-gated applicant form
    preview/                 # read-only pre-submit preview
  api/
    auth/[...all]/           # Better Auth handler
    templates/[templateId]/
    applications/[applicationId]/files/
    apply/[token]/progress|submit/
    cron/renewal-reminders/
components/
  ui/                        # reusable primitives
  form-builder/              # FieldList, FieldEditor, FieldTypeSelector
  form-renderer/             # FormRenderer, SignatureField, FileUploadField
  applications/              # ApplicationTable, StatusBadge, ReviewPanel
  layout/                    # Sidebar, Topbar
lib/
  supabase/client.ts         # browser client (anon key)
  supabase/server.ts         # server client (service role key)
  auth/better-auth.ts        # Better Auth config
  email/ses.ts               # AWS SES wrapper
  tokens.ts                  # token generation
  completion.ts              # completion % calculation
types/index.ts
proxy.ts                     # auth guard (see below — NOT middleware.ts)
supabase/migrations/
supabase/seed/
```

## Next.js 16 breaking changes that affect this project

### `middleware.ts` is renamed to `proxy.ts`

The auth guard file must be `proxy.ts` (not `middleware.ts`). The exported function must be named `proxy`:

```ts
// proxy.ts
export function proxy(request: Request) { … }
```

Config flags also renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.

### All request-time APIs are async — no synchronous access

`cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` **must** be awaited. Synchronous access was removed entirely in v16.

```ts
// Route Handler
export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params           // await params
}

// Page
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params       // await params
  const query   = await props.searchParams  // await searchParams
}

// Server Action / Route Handler
const cookieStore = await cookies()
const headersList = await headers()
```

Run `npx next typegen` to generate `PageProps`, `LayoutProps`, and `RouteContext` type helpers.

### `revalidateTag` requires a second argument

```ts
// v15
revalidateTag('posts')
// v16 — second arg is a cacheLife profile
revalidateTag('posts', 'max')
// For read-your-writes semantics, use updateTag in Server Actions instead
updateTag('posts')
```

### Cache mutation helpers

- `refresh()` from `next/cache` — refreshes the client router from a Server Action
- `updateTag(tag)` — expires and immediately re-fetches (read-your-writes)
- `revalidateTag(tag, profile)` — marks stale; readers see old data while it revalidates
- `cacheLife` / `cacheTag` — stable (no longer need `unstable_` prefix)

### Other removals

- `next lint` command removed — run `eslint` directly
- `serverRuntimeConfig` / `publicRuntimeConfig` removed — use `process.env` / `NEXT_PUBLIC_` env vars
- `next/legacy/image` deprecated — use `next/image`
- `images.domains` deprecated — use `images.remotePatterns`
- Parallel route slots now require explicit `default.js` files

## Key architecture decisions

- **Auth guard**: `proxy.ts` protects all `/(dashboard)` routes via Better Auth session check.
- **Public form routes**: `/apply/[token]/*` — no auth; token validated server-side on every request.
- **Server clients only in API routes**: All `app/api/` routes use the Supabase service-role client (never exposed to the browser). RLS is enforced on the browser anon client.
- **Multi-tenancy via RLS**: All tables have Row Level Security policies. The `auth_company_id()` SQL helper function resolves `company_id` for the current user. Never skip this in application logic.
- **Better Auth user IDs are `TEXT`**: The `user.id` column is a text UUID string, not a Postgres UUID. All foreign keys referencing `user.id` must be `TEXT`.
- **File uploads go server-side**: PDF uploads are proxied through the API route — no direct browser-to-Supabase-Storage uploads — to enforce company-scope checks.
- **Realtime**: Supabase Realtime subscriptions on `last_accessed_at` and `completion_pct` drive live updates on the Incomplete Applications page.
- **Applicants are not users**: Applicants access forms via token only. There is no applicant login or registration in v1.
