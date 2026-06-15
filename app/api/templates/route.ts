import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  sourceTemplateId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const ctx = await getSessionCompany(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: defaults, error: defaultsError } = await supabase
    .from('form_templates')
    .select(`
      *,
      form_template_sections (
        *,
        form_template_fields ( * )
      )
    `)
    .is('company_id', null)
    .eq('is_default', true)
    .order('created_at')

  if (defaultsError) {
    return NextResponse.json({ error: defaultsError.message }, { status: 500 })
  }

  const { data: custom, error: customError } = await supabase
    .from('form_templates')
    .select(`
      *,
      form_template_sections (
        *,
        form_template_fields ( * )
      )
    `)
    .eq('company_id', ctx.companyId)
    .order('created_at')

  if (customError) {
    return NextResponse.json({ error: customError.message }, { status: 500 })
  }

  const sortSections = (template: Record<string, unknown>) => ({
    ...template,
    form_template_sections: (template.form_template_sections as Record<string, unknown>[])
      ?.sort((a, b) => (a.display_order as number) - (b.display_order as number))
      .map((s) => ({
        ...s,
        form_template_fields: (s.form_template_fields as Record<string, unknown>[])
          ?.sort((a, b) => (a.display_order as number) - (b.display_order as number)),
      })),
  })

  return NextResponse.json({
    defaults: (defaults ?? []).map(sortSections),
    custom: (custom ?? []).map(sortSections),
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionCompany(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, sourceTemplateId } = parsed.data
  const supabase = getSupabaseServerClient()

  // Fetch source — must be a default (company_id IS NULL) or belong to this company
  const { data: source, error: sourceError } = await supabase
    .from('form_templates')
    .select(`
      *,
      form_template_sections (
        *,
        form_template_fields ( * )
      )
    `)
    .eq('id', sourceTemplateId)
    .or(`company_id.is.null,company_id.eq.${ctx.companyId}`)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source template not found' }, { status: 404 })
  }

  // Create new template
  const { data: newTemplate, error: templateError } = await supabase
    .from('form_templates')
    .insert({
      company_id: ctx.companyId,
      name,
      type: source.type,
      is_default: false,
      created_by: ctx.user.id,
    })
    .select('id')
    .single()

  if (templateError || !newTemplate) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }

  const newTemplateId = newTemplate.id

  // Copy sections and fields
  const sections = (source.form_template_sections ?? []).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      (a.display_order as number) - (b.display_order as number)
  )

  for (const section of sections) {
    const { data: newSection, error: sectionError } = await supabase
      .from('form_template_sections')
      .insert({
        template_id: newTemplateId,
        label: section.label,
        display_order: section.display_order,
      })
      .select('id')
      .single()

    if (sectionError || !newSection) {
      return NextResponse.json({ error: 'Failed to copy sections' }, { status: 500 })
    }

    const fields = (section.form_template_fields ?? []).sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.display_order as number) - (b.display_order as number)
    )

    if (fields.length > 0) {
      const { error: fieldsError } = await supabase.from('form_template_fields').insert(
        fields.map((f: Record<string, unknown>) => ({
          template_id: newTemplateId,
          section_id: newSection.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          display_order: f.display_order,
          config: f.config,
        }))
      )

      if (fieldsError) {
        return NextResponse.json({ error: 'Failed to copy fields' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ id: newTemplateId }, { status: 201 })
}
