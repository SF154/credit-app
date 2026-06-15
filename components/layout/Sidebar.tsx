'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/dashboard/templates', label: 'Templates' },
  { href: '/dashboard/send', label: 'Send Application' },
  { href: '/dashboard/applications/incomplete', label: 'Incomplete' },
  { href: '/dashboard/applications/submitted', label: 'Submitted' },
  { href: '/dashboard/applications/approved', label: 'Approved' },
  { href: '/dashboard/applications/rejected', label: 'Rejected' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 bg-zinc-900 text-zinc-100 flex flex-col h-screen">
      <div className="px-4 py-5 border-b border-zinc-700">
        <span className="text-sm font-semibold tracking-wide uppercase text-zinc-400">Credit App</span>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-700 text-white font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
