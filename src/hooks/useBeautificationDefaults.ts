'use client'

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { userChoice } from '@/domain/style/elements/base/element-types'
import { normalizeBeautificationValue } from '@/domain/style/elements/beautification/schema'
import {
  DEFAULT_BEAUTIFICATION_VALUE,
  type BeautificationValue,
} from '@/domain/style/elements/beautification/types'
import {
  loadStyleSettings,
  readSavedBeautification,
  saveStyleSettings,
} from '@/lib/clothing-colors-storage'
import { isAbortError } from '@/lib/errors'
import type { PhotoStyleSettings } from '@/types/photo-style'

interface UseBeautificationDefaultsOptions {
  defaultsEndpoint: string
  scope?: string
  enabled?: boolean
}

interface DefaultsResponse {
  defaults?: unknown
}

export interface UseBeautificationDefaultsResult {
  value: BeautificationValue
  setValue: Dispatch<SetStateAction<BeautificationValue>>
  isLoadingDefaults: boolean
  persistDraftToSession: (next: BeautificationValue) => void
}

export function useBeautificationDefaults({
  defaultsEndpoint,
  scope,
  enabled = true,
}: UseBeautificationDefaultsOptions): UseBeautificationDefaultsResult {
  const [value, setValue] = useState<BeautificationValue>(DEFAULT_BEAUTIFICATION_VALUE)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState<boolean>(enabled)

  useEffect(() => {
    if (!enabled) {
      setIsLoadingDefaults(false)
      return
    }

    const controller = new AbortController()
    const signal = controller.signal
    let cancelled = false
    setIsLoadingDefaults(true)

    const run = async () => {
      const saved = readSavedBeautification(scope)
      if (!cancelled && saved) {
        setValue(saved)
      }

      try {
        const defaultsResponse = await fetch(defaultsEndpoint, { cache: 'no-store', signal })
        if (defaultsResponse.ok) {
          const payload = (await defaultsResponse.json()) as DefaultsResponse
          if (!cancelled && !saved) {
            setValue(normalizeBeautificationValue(payload.defaults))
          }
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to load beautification defaults', error)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDefaults(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [defaultsEndpoint, enabled, scope])

  const persistDraftToSession = useCallback(
    (next: BeautificationValue) => {
      const current = loadStyleSettings(scope) || ({} as PhotoStyleSettings)
      saveStyleSettings(
        {
          ...current,
          beautification: userChoice(next),
        } as PhotoStyleSettings,
        scope
      )
    },
    [scope]
  )

  return { value, setValue, isLoadingDefaults, persistDraftToSession }
}
