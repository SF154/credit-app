import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const FieldInputSchema = z.object({
  id: z.string().uuid().optional(),
  field_key: z.string().min(1),
  label: z.string().min(1).max(200),
  field_type: z.enum(['text_single', 'text_multi', 'date', 'number', 'signature', 'file', 'select', 'boolean']),
  is_required: z.boolean(),
  display_order: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
})

const SectionInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(100),
  display_order: z.number().int().min(0),
  fields: z.array(FieldInputSchema),
})

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sections: z.array(SectionInputSchema).optional(),
})

type RouteContext = { params: Promise<{ templateId: string }> }

async function getTemplate(templateId: string, companyId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('form_templates')
    .select(`
      *,
      form_template_sections (
        *,
        form_template_fields ( * )
      )
    `)
    .eq('id', templateId)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .single()
  return { data, error }
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { templateId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getTemplate(templateId, session.companyId)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sorted = {
    ...data,
    form_template_sections: (data.form_template_sections ?? [])
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.display_order as number) - (b.display_order as number))
      .map((s: Record<string, unknown>) => ({
        ...s,
        form_template_fields: (s.form_template_fields as Record<string, unknown>[])
          ?.sort((a, b) => (a.display_order as number) - (b.display_order as number)),
      })),
  }

  return NextResponse.json(sorted)
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const { templateId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  // Verify template belongs to this company (not a default)
  const { data: template } = await supabase
    .from('form_templates')
    .select('id, is_default, company_id')
    .eq('id', templateId)
    .eq('company_id', session.companyId)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.is_default) return NextResponse.json({ error: 'Default templates cannot be edited' }, { status: 403 })

  const body = await request.json()
  const parsed = UpdateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, sections } = parsed.data

  if (name) {
    await supabase
      .from('form_templates')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', templateId)
  }

  if (sections) {
    // Validate field_key uniqueness across all sections
    const allKeys = sections.flatMap((s) => s.fields.map((f) => f.field_key))
    const uniqueKeys = new Set(allKeys)
    if (uniqueKeys.size !== allKeys.length) {
      return NextResponse.json({ error: 'Field keys must be unique within a template' }, { status: 422 })
    }

    // Fetch existing section IDs
    const { data: existingSections } = await supabase
      .from('form_template_sections')
      .select('id')
      .eq('template_id', templateId)

    const existingSectionIds = new Set((existingSections ?? []).map((s: { id: string }) => s.id))
    const incomingSectionIds = new Set(sections.filter((s) => s.id).map((s) => s.id!))

    // Delete removed sections (cascade deletes their fields)
    const toDeleteSections = [...existingSectionIds].filter((id) => !incomingSectionIds.has(id))
    if (toDeleteSections.length > 0) {
      await supabase.from('form_template_sections').delete().in('id', toDeleteSections)
    }

    for (const section of sections) {
      let sectionId: string

      if (section.id && existingSectionIds.has(section.id)) {
        // Update existing section
        await supabase
          .from('form_template_sections')
          .update({ label: section.label, display_order: section.display_order })
          .eq('id', section.id)
        sectionId = section.id
      } else {
        // Insert new section
        const { data: newSection } = await supabase
          .from('form_template_sections')
          .insert({ template_id: templateId, label: section.label, display_order: section.display_order })
          .select('id')
          .single()
        if (!newSection) return NextResponse.json({ error: 'Failed to save section' }, { status: 500 })
        sectionId = newSection.id
      }

      // Fetch existing field IDs for this section
      const { data: existingFields } = await supabase
        .from('form_template_fields')
        .select('id')
        .eq('section_id', sectionId)

      const existingFieldIds = new Set((existingFields ?? []).map((f: { id: string }) => f.id))
      const incomingFieldIds = new Set(section.fields.filter((f) => f.id).map((f) => f.id!))

      // Delete removed fields
      const toDeleteFields = [...existingFieldIds].filter((id) => !incomingFieldIds.has(id))
      if (toDeleteFields.length > 0) {
        await supabase.from('form_template_fields').delete().in('id', toDeleteFields)
      }

      for (const field of section.fields) {
        if (field.id && existingFieldIds.has(field.id)) {
          await supabase
            .from('form_template_fields')
            .update({
              field_key: field.field_key,
              label: field.label,
              field_type: field.field_type,
              is_required: field.is_required,
              display_order: field.display_order,
              config: field.config ?? null,
            })
            .eq('id', field.id)
        } else {
          await supabase.from('form_template_fields').insert({
            template_id: templateId,
            section_id: sectionId,
            field_key: field.field_key,
            label: field.label,
            field_type: field.field_type,
            is_required: field.is_required,
            display_order: field.display_order,
            config: field.config ?? null,
          })
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { templateId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: template } = await supabase
    .from('form_templates')
    .select('id, is_default, company_id')
    .eq('id', templateId)
    .eq('company_id', session.companyId)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.is_default) {
    return NextResponse.json({ error: 'Default templates cannot be deleted' }, { status: 403 })
  }

  // Guard: no active applications
  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
    .in('status', ['sent', 'in_progress', 'incomplete'])

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Cannot delete: template has active applications in progress' },
      { status: 409 }
    )
  }

  await supabase.from('form_templates').delete().eq('id', templateId)

  return NextResponse.json({ success: true })
}
