'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    })

    if (signInError) {
      setError(signInError.message ?? 'Sign in failed. Please check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-zinc-200 p-8">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Sign in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-300 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            placeholder="you@company.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-300 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
