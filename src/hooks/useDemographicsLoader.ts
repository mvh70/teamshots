'use client'

import { useEffect, useState } from 'react'
import { isAbortError } from '@/lib/errors'

export type DetectedGender = 'male' | 'female' | 'unknown'

interface UseDemographicsLoaderOptions {
  endpoint: string
  enabled?: boolean
}

interface DemographicsResponse {
  demographics?: {
    gender?: string
  }
  pendingReanalysisCount?: number
}

interface UseDemographicsLoaderResult {
  detectedGender: DetectedGender
  isLoading: boolean
}

function normalizeGender(value?: string): DetectedGender {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'male') return 'male'
  if (normalized === 'female') return 'female'
  return 'unknown'
}

export function useDemographicsLoader({
  endpoint,
  enabled = true,
}: UseDemographicsLoaderOptions): UseDemographicsLoaderResult {
  const [detectedGender, setDetectedGender] = useState<DetectedGender>('unknown')
  const [isLoading, setIsLoading] = useState<boolean>(enabled)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const signal = controller.signal
    let cancelled = false
    setIsLoading(true)

    const waitWithAbort = (delayMs: number) =>
      new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve()
          return
        }

        const timeout = window.setTimeout(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, delayMs)

        const onAbort = () => {
          window.clearTimeout(timeout)
          signal.removeEventListener('abort', onAbort)
          resolve()
        }

        signal.addEventListener('abort', onAbort, { once: true })
      })

    const run = async () => {
      try {
        const fetchDemographics = async (): Promise<number> => {
          const response = await fetch(endpoint, { cache: 'no-store', signal })
          if (!response.ok) return 0

          const payload = (await response.json()) as DemographicsResponse
          if (!cancelled) {
            setDetectedGender(normalizeGender(payload.demographics?.gender))
          }
          return typeof payload.pendingReanalysisCount === 'number' ? payload.pendingReanalysisCount : 0
        }

        let pendingReanalysis = await fetchDemographics()
        let attempts = 0
        const maxAttempts = 4
        const retryDelayMs = 2000

        while (!cancelled && pendingReanalysis > 0 && attempts < maxAttempts) {
          await waitWithAbort(retryDelayMs)
          if (signal.aborted || cancelled) break
          pendingReanalysis = await fetchDemographics()
          attempts += 1
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to load demographics profile', error)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, endpoint])

  return { detectedGender, isLoading }
}
