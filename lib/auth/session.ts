import { auth } from '@/lib/auth/better-auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export interface SessionCompany {
  user: { id: string; email: string; name: string }
  companyId: string
}

export async function getSessionCompany(request: Request): Promise<SessionCompany | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null

  const supabase = getSupabaseServerClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', session.user.id)
    .single()

  if (!data?.company_id) return null

  return {
    user: session.user as SessionCompany['user'],
    companyId: data.company_id as string,
  }
}
