import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import TermsClientPage from './TermsClientPage'

type RouteContext = { params: Promise<{ token: string }> }

const OPEN_STATUSES = ['sent', 'in_progress', 'incomplete']

export default async function TermsPage({ params }: RouteContext) {
  const { token } = await params
  const supabase = getSupabaseServerClient()

  const { data: app } = await supabase
    .from('applications')
    .select('id, template_id, status, token_expires_at, terms_signed_pdf_path')
    .eq('token', token)
    .single()

  if (!app) redirect(`/apply/${token}`)
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) redirect(`/apply/${token}`)
  if (!OPEN_STATUSES.includes(app.status)) redirect(`/apply/${token}`)

  const { data: template } = await supabase
    .from('form_templates')
    .select('terms_pdf_path')
    .eq('id', app.template_id)
    .single()

  if (!template?.terms_pdf_path) redirect(`/apply/${token}`)

  return (
    <TermsClientPage
      token={token}
      alreadySigned={!!app.terms_signed_pdf_path}
    />
  )
}
