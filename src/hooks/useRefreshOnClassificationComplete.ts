'use client'

import { useEffect, useRef } from 'react'
import type { ClassificationQueueStatus } from '@/components/generation/selection/SelectableGrid'

interface UseRefreshOnClassificationCompleteOptions {
  classificationQueue?: ClassificationQueueStatus
  onComplete: () => void
  enabled?: boolean
}

/**
 * Runs `onComplete` when selfie IDs leave both active and queued classification lists.
 */
export function useRefreshOnClassificationComplete({
  classificationQueue,
  onComplete,
  enabled = true,
}: UseRefreshOnClassificationCompleteOptions) {
  const prevQueueRef = useRef<{ active: string[]; queued: string[] }>({ active: [], queued: [] })

  useEffect(() => {
    if (!enabled || !classificationQueue) return

    const prevActive = prevQueueRef.current.active
    const prevQueued = prevQueueRef.current.queued
    const currentActive = classificationQueue.activeSelfieIds || []
    const currentQueued = classificationQueue.queuedSelfieIds || []

    const completedFromActive = prevActive.filter(
      (id) => !currentActive.includes(id) && !currentQueued.includes(id)
    )
    const completedFromQueued = prevQueued.filter(
      (id) => !currentActive.includes(id) && !currentQueued.includes(id)
    )

    if (completedFromActive.length > 0 || completedFromQueued.length > 0) {
      onComplete()
    }

    prevQueueRef.current = { active: currentActive, queued: currentQueued }
  }, [classificationQueue, onComplete, enabled])
}

