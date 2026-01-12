'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle } from 'lucide-react'
import type { SelfieTypeStatus, SelfieType } from '@/domain/selfie/selfie-types'
import { SELFIE_TYPE_REQUIREMENTS } from '@/domain/selfie/selfie-types'

interface SelfieTypeOverlayProps {
  /** Token for invite/handoff flows */
  token?: string
  /** Called when status changes */
  onStatusChange?: (status: SelfieTypeStatus[]) => void
  /** Refresh trigger - increment to force refresh */
  refreshKey?: number
  className?: string
}

/**
 * Semi-transparent overlay showing selfie type capture status.
 * Positioned at the top of the camera viewfinder.
 *
 * Shows: ✓ Front View | ○ Side View (pending) | ○ Full Body (pending)
 */
export default function SelfieTypeOverlay({
  token,
  onStatusChange,
  refreshKey = 0,
  className = '',
}: SelfieTypeOverlayProps) {
  const t = useTranslations('selfie')
  const [status, setStatus] = useState<SelfieTypeStatus[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div
        className={`bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 ${className}`}
      >
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-xs text-white/70">Loading...</span>
        </div>
      </div>
    )
  }

  const capturedCount = status.filter((s) => s.captured).length
  const totalCount = SELFIE_TYPE_REQUIREMENTS.filter((r) => r.recommended).length

  return (
    <div
      className={`bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 ${className}`}
    >
      <div className="flex items-center justify-center gap-3 text-xs">
        {SELFIE_TYPE_REQUIREMENTS.map((req, index) => {
          const item = status.find((s) => s.type === req.type)
          const captured = item?.captured || false

          return (
            <div key={req.type} className="flex items-center gap-1">
              {index > 0 && (
                <span className="text-white/30 mx-1">|</span>
              )}
              {captured ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-white/40" />
              )}
              <span
                className={`font-medium ${
                  captured ? 'text-white' : 'text-white/60'
                }`}
              >
                {req.label}
              </span>
              {!captured && (
                <span className="text-white/40 text-[10px]">
                  ({t('checklist.pending', { defaultValue: 'pending' })})
                </span>
              )}
            </div>
          )
        })}
      </div>
      {/* Progress indicator */}
      <div className="mt-1.5 flex items-center justify-center">
        <div className="flex items-center gap-1 text-[10px] text-white/50">
          <span>{capturedCount}/{totalCount}</span>
          <span>{t('checklist.captured', { defaultValue: 'captured' })}</span>
        </div>
      </div>
    </div>
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
