import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ token: string }> }

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, company_id, token_expires_at, status')
    .eq('token', token)
    .single()

  if (error || !app) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (!['sent', 'in_progress', 'incomplete'].includes(app.status)) {
    return NextResponse.json({ error: 'not_editable' }, { status: 409 })
  }

  const formData = await request.formData()
  const fieldId = formData.get('fieldId') as string | null
  const file = formData.get('file') as File | null

  if (!fieldId || !file) {
    return NextResponse.json({ error: 'fieldId and file are required' }, { status: 422 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 422 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 422 })
  }

  const bytes = await file.arrayBuffer()
  const storagePath = `${app.company_id}/${app.id}/${fieldId}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('application-files')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Upsert application_files record (one per field per application)
  const { data: fileRecord, error: dbError } = await supabase
    .from('application_files')
    .upsert(
      {
        application_id: app.id,
        field_id: fieldId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: 'application/pdf',
        size_bytes: file.size,
      },
      { onConflict: 'application_id,field_id' }
    )
    .select('id, filename, storage_path')
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ fileId: fileRecord.id, filename: fileRecord.filename, storagePath: fileRecord.storage_path })
}
