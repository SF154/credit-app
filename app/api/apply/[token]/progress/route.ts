import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calculateCompletionPct } from '@/lib/completion'
import type { FormTemplateSectionWithFields, ApplicationFieldResponse, ApplicationFile } from '@/types'

type RouteContext = { params: Promise<{ token: string }> }

const ProgressSchema = z.object({
  responses: z.array(
    z.object({
      fieldId: z.string().uuid(),
      valueText: z.string().optional(),
      valueJson: z.unknown().optional(),
    })
  ),
})

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, company_id, template_id, token_expires_at, status')
    .eq('token', token)
    .single()

  if (error || !app) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (!['sent', 'in_progress', 'incomplete'].includes(app.status)) {
    return NextResponse.json({ error: 'not_editable' }, { status: 409 })
  }

  const body = await request.json()
  const parsed = ProgressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { responses } = parsed.data

  // Upsert all responses
  if (responses.length > 0) {
    const { error: upsertError } = await supabase.from('application_field_responses').upsert(
      responses.map((r) => ({
        application_id: app.id,
        field_id: r.fieldId,
        value_text: r.valueText ?? null,
        value_json: r.valueJson ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'application_id,field_id' }
    )
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }
  }

  // Recalculate completion_pct
  const { data: template } = await supabase
    .from('form_templates')
    .select('*, form_template_sections(*, form_template_fields(*))')
    .eq('id', app.template_id)
    .single()

  const { data: allResponses } = await supabase
    .from('application_field_responses')
    .select('*')
    .eq('application_id', app.id)

  const { data: allFiles } = await supabase
    .from('application_files')
    .select('*')
    .eq('application_id', app.id)

  const sections = (template?.form_template_sections ?? []) as FormTemplateSectionWithFields[]
  const completion_pct = calculateCompletionPct(
    sections,
    (allResponses ?? []) as ApplicationFieldResponse[],
    (allFiles ?? []) as ApplicationFile[]
  )

  await supabase
    .from('applications')
    .update({ completion_pct, last_accessed_at: new Date().toISOString() })
    .eq('id', app.id)

  return NextResponse.json({ completion_pct })
}
