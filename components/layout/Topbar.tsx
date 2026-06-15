'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

export function Topbar() {
  const { data: session } = authClient.useSession()
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 bg-white flex-shrink-0">
      <span className="text-sm text-zinc-500">{session?.user?.email ?? ''}</span>
      <button
        onClick={handleLogout}
        className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        Logout
      </button>
    </header>
  )
}
