import { NextRequest, NextResponse } from 'next/server'
import { getSessionCompany } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ applicationId: string }> }

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { applicationId } = await ctx.params
  const session = await getSessionCompany(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseServerClient()

  const { data: app, error: appError } = await supabase
    .from('applications')
    .select('company_id')
    .eq('id', applicationId)
    .single()

  if (appError || !app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.company_id !== session.companyId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: files, error: filesError } = await supabase
    .from('application_files')
    .select('*')
    .eq('application_id', applicationId)

  if (filesError) return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })

  const results = await Promise.all(
    (files ?? []).map(async (file) => {
      const { data } = await supabase.storage
        .from('application-files')
        .createSignedUrl(file.storage_path, 3600)

      return {
        fieldId: file.field_id,
        filename: file.filename,
        mimeType: file.mime_type,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json(results)
}
