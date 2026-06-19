import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calculateCompletionPct } from '@/lib/completion'
import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'

type RouteContext = { params: Promise<{ token: string }> }

const OPEN_STATUSES = ['sent', 'in_progress', 'incomplete']
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB (annotated PDF may be larger)

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const { data: app } = await supabase
    .from('applications')
    .select('id, company_id, template_id, status, token_expires_at')
    .eq('token', token)
    .single()

  if (!app) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (!OPEN_STATUSES.includes(app.status)) {
    return NextResponse.json({ error: 'not_editable' }, { status: 409 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large' }, { status: 400 })

  const storagePath = `${app.company_id}/${app.id}/terms/signed_terms.pdf`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('application-files')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  await supabase
    .from('applications')
    .update({ terms_signed_pdf_path: storagePath })
    .eq('id', app.id)

  // Recalculate completion_pct with T&C now signed
  const { data: template } = await supabase
    .from('form_templates')
    .select('*, form_template_sections(*, form_template_fields(*))')
    .eq('id', app.template_id)
    .single()

  const [{ data: responses }, { data: files }] = await Promise.all([
    supabase.from('application_field_responses').select('*').eq('application_id', app.id),
    supabase.from('application_files').select('*').eq('application_id', app.id),
  ])

  const sections = (template?.form_template_sections ?? []) as FormTemplateSectionWithFields[]
  const completion_pct = calculateCompletionPct(
    sections,
    (responses ?? []) as ApplicationFieldResponse[],
    (files ?? []) as ApplicationFile[],
    {
      termsRequired: !!(template as { terms_pdf_path?: string | null } | null)?.terms_pdf_path,
      termsSigned: true,
    }
  )

  await supabase
    .from('applications')
    .update({ completion_pct, last_accessed_at: new Date().toISOString() })
    .eq('id', app.id)

  return NextResponse.json({ completion_pct })
}
