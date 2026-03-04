'use client'

import { useEffect, useState } from 'react'
import type { AccessoryProfile } from '@/domain/selfie/selfieAccessories'
import { isAbortError } from '@/lib/errors'

interface UseAccessoriesLoaderOptions {
  endpoint: string
  enabled?: boolean
}

interface AccessoriesResponse {
  accessories?: AccessoryProfile
  pendingReanalysisCount?: number
}

export interface UseAccessoriesLoaderResult {
  accessories: AccessoryProfile | null
  isLoading: boolean
}

export function useAccessoriesLoader({
  endpoint,
  enabled = true,
}: UseAccessoriesLoaderOptions): UseAccessoriesLoaderResult {
  const [accessories, setAccessories] = useState<AccessoryProfile | null>(null)
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
        const fetchAccessories = async (): Promise<number> => {
          const response = await fetch(endpoint, { cache: 'no-store', signal })
          if (!response.ok) {
            return 0
          }

          const payload = (await response.json()) as AccessoriesResponse
          if (!cancelled) {
            setAccessories(payload.accessories ?? null)
          }

          return typeof payload.pendingReanalysisCount === 'number' ? payload.pendingReanalysisCount : 0
        }

        let pendingReanalysis = await fetchAccessories()
        let attempts = 0
        const maxAttempts = 4
        const retryDelayMs = 2000

        while (!cancelled && pendingReanalysis > 0 && attempts < maxAttempts) {
          await waitWithAbort(retryDelayMs)
          if (signal.aborted || cancelled) {
            break
          }
          pendingReanalysis = await fetchAccessories()
          attempts += 1
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to load accessories profile', error)
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

  return { accessories, isLoading }
}

