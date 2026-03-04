'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClassificationQueueStatus } from '@/components/generation/selection/SelectableGrid'

interface UseClassificationQueueOptions {
  /** Token for invite/handoff flows */
  token?: string
  /** Handoff token for mobile handoff flows */
  handoffToken?: string
  /** Polling interval in ms (default: 2000) */
  pollingInterval?: number
  /** Whether to enable polling (default: true when there are unclassified selfies) */
  enabled?: boolean
}

/**
 * Hook to poll the classification queue status.
 * Returns which selfies are actively being analyzed vs queued.
 */
export function useClassificationQueue({
  token,
  handoffToken,
  pollingInterval = 2000,
  enabled = true,
}: UseClassificationQueueOptions = {}): ClassificationQueueStatus | undefined {
  const [status, setStatus] = useState<ClassificationQueueStatus | undefined>(undefined)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const emptyPollCountRef = useRef(0)

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      if (handoffToken) params.set('handoffToken', handoffToken)

      const url = `/api/selfies/classification-queue${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url, { credentials: 'include', cache: 'no-store' })

      if (response.ok) {
        const data = await response.json()
        const activeSelfieIds = Array.isArray(data.activeSelfieIds) ? data.activeSelfieIds : []
        const queuedSelfieIds = Array.isArray(data.queuedSelfieIds) ? data.queuedSelfieIds : []

        setStatus({
          activeSelfieIds,
          queuedSelfieIds,
        })

        if (activeSelfieIds.length === 0 && queuedSelfieIds.length === 0) {
          emptyPollCountRef.current += 1
          if (emptyPollCountRef.current >= 2 && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        } else {
          emptyPollCountRef.current = 0
        }
      }
    } catch (error) {
      console.error('[useClassificationQueue] Error fetching status:', error)
    }
  }, [token, handoffToken])

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      emptyPollCountRef.current = 0
      return
    }

    // Fetch immediately
    queueMicrotask(() => {
      void fetchStatus()
    })

    // Then poll (skip when page is hidden to avoid unnecessary network/battery usage)
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void fetchStatus()
    }, pollingInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, fetchStatus, pollingInterval])

  return status
}
