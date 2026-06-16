import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ token: string }> }

const OPEN_STATUSES = ['sent', 'in_progress', 'incomplete']

async function resolveApplication(token: string) {
  const supabase = getSupabaseServerClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !app) return { error: 'not_found' as const }

  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return { error: 'expired' as const, applicantCompany: app.applicant_company }
  }

  if (!OPEN_STATUSES.includes(app.status)) {
    return { error: app.status as 'submitted' | 'approved' | 'rejected', applicantCompany: app.applicant_company }
  }

  return { app }
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const resolved = await resolveApplication(token)
  if ('error' in resolved) {
    const status = resolved.error === 'not_found' ? 404 : resolved.error === 'expired' ? 410 : 409
    return NextResponse.json({ error: resolved.error, applicantCompany: resolved.applicantCompany }, { status })
  }

  const { app } = resolved

  // Update last_accessed_at and promote sent → in_progress
  const updates: Record<string, unknown> = { last_accessed_at: new Date().toISOString() }
  if (app.status === 'sent') updates.status = 'in_progress'

  await supabase.from('applications').update(updates).eq('id', app.id)

  // Fetch template with sections + fields
  const { data: template, error: templateError } = await supabase
    .from('form_templates')
    .select(`
      *,
      form_template_sections (
        *,
        form_template_fields ( * )
      )
    `)
    .eq('id', app.template_id)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'template_not_found' }, { status: 500 })
  }

  // Sort sections and fields by display_order
  const sortedTemplate = {
    ...template,
    form_template_sections: (template.form_template_sections ?? [])
      .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
      .map((s: { form_template_fields: { display_order: number }[] }) => ({
        ...s,
        form_template_fields: (s.form_template_fields ?? []).sort(
          (a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order
        ),
      })),
  }

  // Fetch saved responses and files
  const [{ data: responses }, { data: files }] = await Promise.all([
    supabase.from('application_field_responses').select('*').eq('application_id', app.id),
    supabase.from('application_files').select('*').eq('application_id', app.id),
  ])

  return NextResponse.json({
    application: { ...app, ...updates },
    template: sortedTemplate,
    responses: responses ?? [],
    files: files ?? [],
  })
}
