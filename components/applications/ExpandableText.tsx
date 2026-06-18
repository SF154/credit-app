'use client'

import { useState } from 'react'

interface ExpandableTextProps {
  text: string
  maxLength?: number
}

export function ExpandableText({ text, maxLength = 100 }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)

  if (text.length <= maxLength) {
    return <span className="text-sm text-zinc-700">{text}</span>
  }

  return (
    <span className="text-sm text-zinc-700">
      {expanded ? text : `${text.slice(0, maxLength)}…`}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1.5 text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  )
}
