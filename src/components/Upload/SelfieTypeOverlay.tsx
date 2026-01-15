'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import type { SelfieTypeStatus, SelfieType } from '@/domain/selfie/selfie-types'
import { SELFIE_TYPE_REQUIREMENTS } from '@/domain/selfie/selfie-types'
import SelfieTipsContent from '@/components/generation/SelfieTipsContent'

interface SelfieTypeOverlayProps {
  /** Token for invite/handoff flows */
  token?: string
  /** Called when status changes */
  onStatusChange?: (status: SelfieTypeStatus[]) => void
  /** Refresh trigger - increment to force refresh */
  refreshKey?: number
  className?: string
  /** Show the tips header with learn more link */
  showTipsHeader?: boolean
}

/**
 * Card showing selfie type capture status with pill badges.
 * Shows captured types with green badges, pending with gray outlined badges.
 * Optionally includes tips header with link to detailed tips overlay.
 */
export default function SelfieTypeOverlay({
  token,
  onStatusChange,
  refreshKey = 0,
  className = '',
  showTipsHeader = false,
}: SelfieTypeOverlayProps) {
  const t = useTranslations('selfie')
  const tSelfies = useTranslations('selfies')
  const [status, setStatus] = useState<SelfieTypeStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [tipsOpen, setTipsOpen] = useState(false)

  const closeTips = useCallback(() => setTipsOpen(false), [])

  // Handle escape key for tips overlay
  useEffect(() => {
    if (!tipsOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTips()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tipsOpen, closeTips])

  const fetchStatus = useCallback(async () => {
    try {
      const url = token
        ? `/api/selfies/type-status?token=${encodeURIComponent(token)}`
        : '/api/selfies/type-status'

      const response = await fetch(url, { credentials: 'include' })

      if (response.ok) {
        const data = await response.json()
        setStatus(data.status)
        onStatusChange?.(data.status)
      }
    } catch (error) {
      console.error('Failed to fetch selfie type status:', error)
      // Set empty status on error
      setStatus(
        SELFIE_TYPE_REQUIREMENTS.map((req) => ({
          type: req.type as SelfieType,
          captured: false,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [token, onStatusChange])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus, refreshKey])

  // Loading state
  const loadingContent = (
    <div className="flex items-center gap-2 py-1">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-primary rounded-full animate-spin" />
      <span className="text-sm text-gray-500">{t('classification.analyzing')}</span>
    </div>
  )

  // Check if still analyzing
  const hasAnyClassified = status.some((s) => s.captured)
  const allPending = !hasAnyClassified && status.length > 0
  const isAnalyzing = loading || allPending

  return (
    <>
      <div
        className={`bg-white border border-gray-200 rounded-xl px-4 py-4 shadow-sm ${className}`}
      >
        {/* Tips header */}
        {showTipsHeader && (
          <div className="mb-4 pb-3 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-snug">
              {tSelfies('tipsIntro')}
            </p>
            <button
              type="button"
              onClick={() => setTipsOpen(true)}
              className="mt-1 text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors"
            >
              {tSelfies('learnMore', { defaultValue: 'Learn more →' })}
            </button>
          </div>
        )}

        {isAnalyzing ? (
          loadingContent
        ) : (
          <>
            {/* Micro-title */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {t('checklist.progress', { defaultValue: 'Your progress' })}
            </p>
            {/* Selfie type badges - show recommended types, with body as combined */}
            <div className="flex flex-wrap items-center gap-2">
              {SELFIE_TYPE_REQUIREMENTS.filter((req) => req.recommended && req.type !== 'full_body').map((req) => {
                const item = status.find((s) => s.type === req.type)
                const captured = item?.captured || false

                return (
                  <div
                    key={req.type}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      captured
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {captured && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {t(`types.${req.type.replace('_', '')}.label`, { defaultValue: req.label })}
                    </span>
                  </div>
                )
              })}
              {/* Body badge - captured if either partial_body or full_body exists */}
              {(() => {
                const hasBody = status.some((s) =>
                  (s.type === 'partial_body' || s.type === 'full_body') && s.captured
                )
                return (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      hasBody
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {hasBody && (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {t('types.body.label', { defaultValue: 'Body' })}
                    </span>
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>

      {/* Tips overlay */}
      {tipsOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Selfie tips"
          onClick={closeTips}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeTips}
              className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              aria-label="Close selfie tips"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-5 sm:p-7">
              <SelfieTipsContent variant="button" onContinue={closeTips} className="max-w-4xl mx-auto" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Hook for managing selfie type status with refresh capability
 */
export function useSelfieTypeStatus(token?: string) {
  const [status, setStatus] = useState<SelfieTypeStatus[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  return {
    status,
    refreshKey,
    refresh,
    setStatus,
  }
}
