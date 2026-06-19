'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ReactSketchCanvas, type ReactSketchCanvasRef, type CanvasPath } from 'react-sketch-canvas'
import { PDFDocument } from 'pdf-lib'
import SignatureField from '@/components/form-renderer/SignatureField'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PDF_WIDTH = 680

interface Props {
  token: string
  alreadySigned: boolean
}

export default function TermsClientPage({ token, alreadySigned }: Props) {
  const router = useRouter()

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({})
  const [tool, setTool] = useState<'draw' | 'erase'>('draw')
  const [signature, setSignature] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(false)

  const canvasRef = useRef<ReactSketchCanvasRef>(null)
  const pageAnnotationsRef = useRef<Record<number, CanvasPath[]>>({})

  useEffect(() => {
    fetch(`/api/apply/${token}/terms-pdf`)
      .then((r) => r.json())
      .then((data) => {
        if (data.signedUrl) setPdfUrl(data.signedUrl)
        else setError('Could not load the Terms & Conditions document.')
      })
      .catch(() => setError('Could not load the Terms & Conditions document.'))
  }, [token])

  useEffect(() => {
    canvasRef.current?.eraseMode(tool === 'erase')
  }, [tool])

  useEffect(() => {
    if (!canvasRef.current) return
    const paths = pageAnnotationsRef.current[currentPage] ?? []
    canvasRef.current.clearCanvas()
    if (paths.length > 0) canvasRef.current.loadPaths(paths)
  }, [currentPage])

  const saveCurrentPagePaths = useCallback(async () => {
    if (!canvasRef.current) return
    const paths = await canvasRef.current.exportPaths()
    pageAnnotationsRef.current = { ...pageAnnotationsRef.current, [currentPage]: paths }
  }, [currentPage])

  const goToPage = useCallback(
    async (newPage: number) => {
      await saveCurrentPagePaths()
      setCurrentPage(newPage)
    },
    [saveCurrentPagePaths]
  )

  const handleClearPage = () => canvasRef.current?.clearCanvas()

  const handleAccept = async () => {
    if (!signature || !pdfUrl) return
    setProcessing(true)
    setError(null)

    try {
      await saveCurrentPagePaths()

      const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer())
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pdfPages = pdfDoc.getPages()

      // Burn annotations into each page that has them
      for (let i = 0; i < pdfPages.length; i++) {
        const pageNum = i + 1
        const paths = pageAnnotationsRef.current[pageNum]
        if (!paths || paths.length === 0) continue

        // Load paths into canvas and export as PNG
        canvasRef.current!.clearCanvas()
        canvasRef.current!.loadPaths(paths)
        await new Promise((r) => setTimeout(r, 80))
        const annotationDataUrl = await canvasRef.current!.exportImage('png')

        const annotationBytes = await fetch(annotationDataUrl).then((r) => r.arrayBuffer())
        const pngImage = await pdfDoc.embedPng(annotationBytes)
        const { width, height } = pdfPages[i].getSize()
        pdfPages[i].drawImage(pngImage, { x: 0, y: 0, width, height })
      }

      // Restore canvas to current page
      canvasRef.current!.clearCanvas()
      const restoredPaths = pageAnnotationsRef.current[currentPage] ?? []
      if (restoredPaths.length > 0) canvasRef.current!.loadPaths(restoredPaths)

      // Burn signature into footer of last page
      const sigBytes = await fetch(signature).then((r) => r.arrayBuffer())
      const sigImage = await pdfDoc.embedPng(sigBytes)
      const lastPage = pdfPages[pdfPages.length - 1]
      lastPage.drawImage(sigImage, { x: 20, y: 20, width: 200, height: 60 })

      const finalBytes = await pdfDoc.save()
      const blob = new Blob([finalBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })

      const fd = new FormData()
      fd.append('file', blob, 'signed_terms.pdf')
      const res = await fetch(`/api/apply/${token}/terms`, { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save signed terms.')
        return
      }

      router.push(`/apply/${token}`)
    } catch (e) {
      console.error(e)
      setError('An error occurred while processing the document. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const dims = pageDimensions[currentPage] ?? { width: PDF_WIDTH, height: Math.round(PDF_WIDTH * 1.414) }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Terms &amp; Conditions</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Review the document below. Draw to mark clauses you wish to exclude, then sign and accept.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/apply/${token}`)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {alreadySigned && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            You have already signed this document. You may review it and re-sign if needed.
          </div>
        )}

        {/* Toolbar */}
        {pdfUrl && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTool('draw')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                tool === 'draw'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => setTool('erase')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                tool === 'erase'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Eraser
            </button>
            <button
              type="button"
              onClick={handleClearPage}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Clear page
            </button>
            {numPages > 1 && (
              <span className="ml-auto text-xs text-gray-500">
                Page {currentPage} of {numPages}
              </span>
            )}
          </div>
        )}

        {/* PDF viewer + annotation canvas */}
        {!pdfUrl && !error && (
          <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-zinc-200">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        )}

        {error && !pdfUrl && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {pdfUrl && (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n)
                setPdfReady(true)
              }}
              loading={
                <div className="flex items-center justify-center h-64 text-sm text-gray-400">
                  Loading document…
                </div>
              }
            >
              <div style={{ position: 'relative', display: 'inline-block', width: PDF_WIDTH }}>
                <Page
                  pageNumber={currentPage}
                  width={PDF_WIDTH}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onRenderSuccess={(page) => {
                    setPageDimensions((prev) => ({
                      ...prev,
                      [currentPage]: { width: page.width, height: page.height },
                    }))
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: dims.width,
                    height: dims.height,
                    pointerEvents: pdfReady ? 'auto' : 'none',
                  }}
                >
                  <ReactSketchCanvas
                    ref={canvasRef}
                    width={`${dims.width}px`}
                    height={`${dims.height}px`}
                    strokeColor="#dc2626"
                    strokeWidth={3}
                    eraserWidth={20}
                    canvasColor="transparent"
                    style={{ border: 'none', borderRadius: 0 }}
                  />
                </div>
              </div>
            </Document>

            {numPages > 1 && (
              <div className="flex items-center justify-center gap-3 border-t border-zinc-100 px-4 py-3">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className="px-3 py-1 text-xs border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-xs text-zinc-500">
                  {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= numPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className="px-3 py-1 text-xs border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Signature */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Your Signature</h2>
          <p className="text-xs text-gray-500">
            Sign below to confirm you have reviewed the Terms &amp; Conditions.
          </p>
          <SignatureField value={signature} onChange={setSignature} />
        </div>

        {error && pdfUrl && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!signature || processing || !pdfReady}
            onClick={handleAccept}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? 'Processing…' : 'Accept & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
