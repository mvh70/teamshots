'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Info, X } from 'lucide-react'
import SelfieTipsContent from './SelfieTipsContent'

interface SelfieInfoOverlayTriggerProps {
  className?: string
  /** Optional variant for tighter spacing when embedded in grids */
  dense?: boolean
}

/**
 * Compact info trigger that opens a fullscreen overlay with selfie tips.
 * Hidden content stays reusable across logged-in, invite, and mobile flows.
 */
export default function SelfieInfoOverlayTrigger({ className = '', dense = false }: SelfieInfoOverlayTriggerProps) {
  const t = useTranslations('selfies')
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-start gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-left shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${dense ? 'w-full' : ''} ${className}`}
      >
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm sm:text-base text-gray-800 leading-snug">
          {t('tipsIntro')}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Selfie tips"
          onClick={close}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              aria-label="Close selfie tips"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-5 sm:p-7">
              <SelfieTipsContent variant="button" onContinue={close} className="max-w-4xl mx-auto" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

