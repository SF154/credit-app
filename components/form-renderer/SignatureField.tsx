'use client'

import { useEffect, useRef } from 'react'
import SignaturePad from 'signature_pad'

interface SignatureFieldProps {
  value: string | null
  onChange: (base64: string | null) => void
  disabled?: boolean
}

export default function SignatureField({ value, onChange, disabled }: SignatureFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' })
    padRef.current = pad

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      pad.clear()
      if (value) {
        pad.fromDataURL(value)
      }
    }

    resize()
    window.addEventListener('resize', resize)

    if (disabled) pad.off()

    pad.addEventListener('endStroke', () => {
      if (pad.isEmpty()) {
        onChange(null)
      } else {
        onChange(pad.toDataURL('image/png'))
      }
    })

    return () => {
      window.removeEventListener('resize', resize)
      pad.off()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  // Sync external value changes (e.g. on load from saved data)
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    if (value && pad.isEmpty()) {
      pad.fromDataURL(value)
    } else if (!value) {
      pad.clear()
    }
  }, [value])

  const handleClear = () => {
    padRef.current?.clear()
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg border border-gray-300 bg-white overflow-hidden" style={{ height: 180 }}>
        <canvas ref={canvasRef} className="w-full h-full touch-none" />
        {!disabled && (
          <span className="absolute bottom-2 left-2 text-xs text-gray-400 pointer-events-none select-none">
            Sign above
          </span>
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="self-start text-xs text-gray-500 underline hover:text-gray-700"
        >
          Clear
        </button>
      )}
    </div>
  )
}
