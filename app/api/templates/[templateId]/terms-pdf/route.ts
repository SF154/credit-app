import { NextRequest, NextResponse } from 'next/server'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ templateId: string }> }

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { templateId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: template } = await supabase
    .from('form_templates')
    .select('id, is_default, company_id, terms_pdf_path')
    .eq('id', templateId)
    .eq('company_id', session.companyId)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.is_default) return NextResponse.json({ error: 'Default templates cannot be edited' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  // Remove old file if one exists
  if (template.terms_pdf_path) {
    await supabase.storage.from('application-files').remove([template.terms_pdf_path])
  }

  const storagePath = `${session.companyId}/terms/${templateId}/terms.pdf`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('application-files')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: updateError } = await supabase
    .from('form_templates')
    .update({ terms_pdf_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ terms_pdf_path: storagePath })
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { templateId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: template } = await supabase
    .from('form_templates')
    .select('id, is_default, company_id, terms_pdf_path')
    .eq('id', templateId)
    .eq('company_id', session.companyId)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.is_default) return NextResponse.json({ error: 'Default templates cannot be edited' }, { status: 403 })

  if (template.terms_pdf_path) {
    await supabase.storage.from('application-files').remove([template.terms_pdf_path])
  }

  await supabase
    .from('form_templates')
    .update({ terms_pdf_path: null, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  return NextResponse.json({ success: true })
}
