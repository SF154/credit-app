'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewPanelProps {
  applicationId: string
}

type Action = 'approve' | 'reject' | 'incomplete'

export function ReviewPanel({ applicationId }: ReviewPanelProps) {
  const router = useRouter()
  const [pending, setPending] = useState<Action | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [incompleteFeedback, setIncompleteFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = (action: Action) => {
    if (loading) return
    setPending(action)
    setError(null)
    if (action !== 'reject') setRejectionReason('')
    if (action !== 'incomplete') setIncompleteFeedback('')
  }

  const handleConfirm = async () => {
    if (!pending) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: pending === 'approve' ? 'approved' : pending === 'reject' ? 'rejected' : 'incomplete',
          rejectionReason: pending === 'reject' ? rejectionReason.trim() : undefined,
          incompleteFeedback: pending === 'incomplete' && incompleteFeedback.trim() ? incompleteFeedback.trim() : undefined,
        }),
      })

      if (res.status === 409) {
        setError('This application has already been actioned by another user.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Action failed. Please try again.')
        setLoading(false)
        return
      }

      router.push('/dashboard/applications/submitted')
    } catch {
      setError('Action failed. Please try again.')
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setPending(null)
    setError(null)
    setRejectionReason('')
    setIncompleteFeedback('')
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Review Decision</h2>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleSelect('approve')}
          disabled={loading}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            pending === 'approve'
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'border-blue-300 text-blue-600 hover:bg-blue-50'
          } disabled:opacity-50`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleSelect('reject')}
          disabled={loading}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            pending === 'reject'
              ? 'bg-red-600 border-red-600 text-white'
              : 'border-red-300 text-red-700 hover:bg-red-50'
          } disabled:opacity-50`}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => handleSelect('incomplete')}
          disabled={loading}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            pending === 'incomplete'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'border-amber-300 text-amber-700 hover:bg-amber-50'
          } disabled:opacity-50`}
        >
          Mark Incomplete
        </button>
      </div>

      {pending && (
        <div className="space-y-3 border-t border-zinc-100 pt-4">
          {pending === 'approve' && (
            <p className="text-sm text-zinc-700">
              Approve this application? The applicant will be notified by email.
            </p>
          )}

          {pending === 'incomplete' && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">
                Return this application as incomplete? The applicant will be sent a link to revisit
                and update their form. Their token expiry will be extended by 30 days.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="block text-sm font-medium text-zinc-700">Additional Feedback</label>
                  <span className="text-xs text-zinc-400">Optionally provide specific feedback to guide the applicant on what they still need to do</span>
                </div>
                <textarea
                  value={incompleteFeedback}
                  onChange={(e) => setIncompleteFeedback(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please upload a clear copy of your trade reference and complete the banking details section…"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {pending === 'reject' && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="block text-sm font-medium text-zinc-700">Rejection reason</label>
                <span className="text-xs text-zinc-400">For internal use only — not shared with the applicant</span>
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Provide a reason for rejection…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                pending === 'approve'
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : pending === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {loading ? 'Processing…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
