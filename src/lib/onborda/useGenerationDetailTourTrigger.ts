'use client'

import { useEffect, useRef } from 'react'

interface GenerationWithStatus {
  status: string
}

interface UseGenerationDetailTourTriggerOptions {
  loading: boolean
  generations: GenerationWithStatus[]
  onboardingLoaded: boolean
  completedTours?: string[]
  force?: boolean
  startTour: (tourName: string, force?: boolean) => void
}

const TOUR_NAME = 'generation-detail'
const TARGET_SELECTORS = [
  '[data-onborda="regenerations-info"]',
  '[data-onborda="photos-info"]',
  '[data-onborda="feedback-rating"]',
] as const
const TARGET_WAIT_TIMEOUT_MS = 3000
const TARGET_POLL_INTERVAL_MS = 120

const hasAllTourTargets = () => {
  if (typeof document === 'undefined') return false
  return TARGET_SELECTORS.every(selector => document.querySelector(selector))
}

export function useGenerationDetailTourTrigger({
  loading,
  generations,
  onboardingLoaded,
  completedTours,
  force = false,
  startTour,
}: UseGenerationDetailTourTriggerOptions) {
  const requestedRef = useRef(false)

  useEffect(() => {
    if (loading || !onboardingLoaded) {
      return
    }

    const hasCompletedGeneration = generations.some(generation => generation.status === 'completed')
    if (!hasCompletedGeneration) {
      requestedRef.current = false
      return
    }

    const hasCompletedTour = (completedTours || []).includes(TOUR_NAME)
    if (hasCompletedTour && !force) {
      return
    }

    if (requestedRef.current) {
      return
    }

    let cancelled = false
    const startedAt = Date.now()

    const tryStartTour = () => {
      if (cancelled || requestedRef.current) {
        return
      }

      const hasTargets = hasAllTourTargets()
      const timedOut = Date.now() - startedAt >= TARGET_WAIT_TIMEOUT_MS

      if (hasTargets || timedOut) {
        requestedRef.current = true
        startTour(TOUR_NAME, force)
        return
      }

      window.setTimeout(tryStartTour, TARGET_POLL_INTERVAL_MS)
    }

    tryStartTour()

    return () => {
      cancelled = true
    }
  }, [loading, onboardingLoaded, generations, completedTours, force, startTour])
}
