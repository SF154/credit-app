import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ token: string }> }

const OPEN_STATUSES = ['sent', 'in_progress', 'incomplete']

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params
  const supabase = getSupabaseServerClient()

  const { data: app } = await supabase
    .from('applications')
    .select('id, template_id, status, token_expires_at')
    .eq('token', token)
    .single()

  if (!app) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }
  if (!OPEN_STATUSES.includes(app.status)) {
    return NextResponse.json({ error: 'not_editable' }, { status: 409 })
  }

  const { data: template } = await supabase
    .from('form_templates')
    .select('terms_pdf_path')
    .eq('id', app.template_id)
    .single()

  if (!template?.terms_pdf_path) {
    return NextResponse.json({ error: 'no_terms' }, { status: 404 })
  }

  const { data } = await supabase.storage
    .from('application-files')
    .createSignedUrl(template.terms_pdf_path, 3600)

  return NextResponse.json({ signedUrl: data?.signedUrl ?? null })
}
