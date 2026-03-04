'use client'

import { useCallback, useState } from 'react'
import type { OnboardingContext as OnboardingContextType } from '@/lib/onborda/config'

interface UseHideScreenOptions {
  context: OnboardingContextType
  updateContext: (updates: Partial<OnboardingContextType>) => void
  onComplete: () => void
  token?: string
  onErrorLogPrefix?: string
}

export function useHideScreen(screenName: string, options: UseHideScreenOptions) {
  const [isSaving, setIsSaving] = useState(false)

  const handleHideScreen = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)

    try {
      const payload: { screenName: string; token?: string } = { screenName }
      if (options.token) {
        payload.token = options.token
      }

      const response = await fetch('/api/onboarding/hide-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      const hiddenScreensFromResponse = Array.isArray(data.hiddenScreens) ? data.hiddenScreens : [screenName]
      const updatedHiddenScreens = Array.from(
        new Set([...(options.context.hiddenScreens || []), ...hiddenScreensFromResponse])
      )
      options.updateContext({ hiddenScreens: updatedHiddenScreens })
    } catch (error) {
      console.error(options.onErrorLogPrefix ?? '[useHideScreen] Failed to persist hide-screen preference', error)
    } finally {
      setIsSaving(false)
      options.onComplete()
    }
  }, [isSaving, options, screenName])

  return {
    handleHideScreen,
    isSaving,
  }
}
