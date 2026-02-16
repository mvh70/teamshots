"use client"

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDate } from '@/lib/format'
import { LoadingSpinner } from '@/components/ui'
import { GenerationRating } from '@/components/feedback/GenerationRating'
import { useGenerationStatus } from '../hooks/useGenerationStatus'
import { DeleteConfirmationDialog } from '@/components/generation/DeleteConfirmationDialog'
import { trackPhotoDownloaded, trackRegenerateClicked } from '@/lib/track'

export type GenerationListItem = {
  id: string
  uploadedKey: string
  acceptedKey?: string
  generatedKey?: string
  inputSelfieUrls?: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  contextName?: string
  contextId?: string
  costCredits: number
  userId?: string
  maxRegenerations: number
  remainingRegenerations: number
  generationType: 'personal' | 'team'
  isOriginal?: boolean
  isOwnGeneration?: boolean
  personId?: string
  personFirstName?: string
  personUserId?: string
  jobStatus?: {
    id: string
    progress: number
    message?: string
    attemptsMade: number
    processedOn?: number
    finishedOn?: number
    failedReason?: string
  }
}

const MAX_IMAGE_RETRY_ATTEMPTS = 2
const TIMED_PROGRESS_DURATION_MS = 90_000
const PROGRESS_MILESTONE_STEP = 10
const WORKFLOW_PROGRESS_MILESTONES = [10, 15, 30, 40, 50, 60, 85, 100] as const
type ProgressTheme = 'runner' | 'butterfly' | 'lion'

const getProgressTheme = (id: string): ProgressTheme => {
  const hash = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const themes: ProgressTheme[] = ['runner', 'butterfly', 'lion']
  return themes[hash % themes.length]
}

const stripProgressPercentage = (message?: string) => {
  if (!message) return ''
  return message
    .replace(/\s*\d{1,3}%/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-–—:|]\s*$/, '')
    .trim()
}

const compactProgressMessage = (message?: string) => {
  if (!message) return ''
  const withoutPrefix = message.replace(/^generation\s*#?\d+\s*[-:]\s*/i, '').trim()
  if (withoutPrefix.length <= 58) return withoutPrefix
  return `${withoutPrefix.slice(0, 57).trimEnd()}…`
}

const extractWorkflowStepFromMessage = (message?: string) => {
  if (!message) return null
  const match = message.match(/\[(\d)\s*\/\s*4\]/)
  if (!match) return null
  const step = Number.parseInt(match[1], 10)
  if (!Number.isFinite(step) || step < 1 || step > 4) return null
  return step as 1 | 2 | 3 | 4
}

const normalizeProgressPercent = (progress?: number) => {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return null
  // Some job systems report progress as 0..1 instead of 0..100.
  const normalized = progress > 0 && progress < 1 ? progress * 100 : progress
  const clamped = Math.max(0, Math.min(100, normalized))
  // Anchor tiny non-zero values to first meaningful workflow milestone.
  if (clamped > 0 && clamped < 15) return 15
  return clamped
}

const inferWorkflowStepFromProgress = (progress?: number) => {
  const normalized = normalizeProgressPercent(progress)
  if (normalized === null || normalized <= 0) return null
  if (normalized >= 85) return 4 as const
  if (normalized >= 50) return 3 as const
  if (normalized >= 15) return 2 as const
  return 1 as const
}

const FALLBACK_WORKFLOW_MESSAGES: Record<1 | 2 | 3 | 4, string> = {
  1: '[1/4] Preparing your photo session...',
  2: '[2/4] Creating your portrait...',
  3: '[3/4] Composing the final photo...',
  4: '[4/4] Final quality check...'
}

const getNextMilestone = (currentProgress: number) => {
  return WORKFLOW_PROGRESS_MILESTONES.find(milestone => currentProgress < milestone) ?? 100
}

const easeInOutCubic = (t: number) => {
  if (t < 0.5) {
    return 4 * t * t * t
  }
  return 1 - Math.pow(-2 * t + 2, 3) / 2
}

const getStableHash = (value: string) => {
  return Array.from(value).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7)
}

const buildImageUrl = (key: string, retryVersion: number, token?: string) => {
  const params = new URLSearchParams({ key })
  if (retryVersion > 0) {
    params.set('retry', retryVersion.toString())
  }
  if (token) {
    params.set('token', token)
  }
  return `/api/files/get?${params.toString()}`
}

export default function GenerationCard({ item, currentUserId, token, onImageClick }: { item: GenerationListItem; currentUserId?: string; token?: string; onImageClick?: (src: string) => void }) {
  const t = useTranslations('generations')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [beforeImageError, setBeforeImageError] = useState(false)
  const [afterImageError, setAfterImageError] = useState(false)
  const [beforeRetryCount, setBeforeRetryCount] = useState(0)
  const [afterRetryCount, setAfterRetryCount] = useState(0)
  const [loadedGenerated, setLoadedGenerated] = useState(false)
  const [failedGenerationHidden, setFailedGenerationHidden] = useState(false)
  const failedGenerationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const waitingForKeysTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousAfterKeyRef = useRef<string | null>(null) // Track previous key to detect actual changes
  const beforeKey = item.uploadedKey
  const normalizedBeforeKey = beforeKey && beforeKey !== 'undefined' ? beforeKey : null

  // Use real-time status polling only for incomplete generations
  // Skip polling for completed generations and invite flows (invite flows have their own refresh mechanism)
  const initialShouldPoll = (item.status === 'pending' || item.status === 'processing') || (!item.generatedKey && !item.acceptedKey)
  const { generation: liveGeneration } = useGenerationStatus({
    generationId: item.id,
    enabled: initialShouldPoll && !token, // Only enable for incomplete generations in non-invite flows
    pollInterval: 1000, // Poll every second for incomplete generations
  })

  // Use live data if available, otherwise fall back to static item data
  // IMPORTANT: Use ternary instead of || to avoid falling back to stale item.jobStatus
  // when liveGeneration exists but jobStatus is null (happens when generation completes)
  const currentJobStatus = liveGeneration !== null ? liveGeneration.jobStatus : item.jobStatus
  const currentStatus = liveGeneration?.status || item.status

  // Extract generated key from live generation if available
  // The API returns generatedImageUrls as URLs, so we need to extract the key from the URL
  const extractKeyFromUrl = (url: string): string | null => {
    if (!url) return null
    try {
      // Handle both absolute and relative URLs
      const urlObj = url.startsWith('http')
        ? new URL(url)
        : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      const key = urlObj.searchParams.get('key')
      if (key) {
        const decoded = decodeURIComponent(key)
        // Validate that we got a meaningful key (not empty)
        if (decoded && decoded.length > 0) {
          return decoded
        }
      }
    } catch (error) {
      console.warn('Failed to parse URL, trying regex extraction:', url, error)
    }
    // If URL parsing fails, try to extract key directly from query string
    const match = url.match(/[?&]key=([^&]+)/)
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1])
        if (decoded && decoded.length > 0) {
          return decoded
        }
      } catch (e) {
        console.warn('Failed to decode extracted key:', match[1], e)
      }
    }
    return null
  }

  // Get generated key from live generation or fall back to item
  // The API now returns generatedPhotoKeys directly, so we use those instead of extracting from URLs
  const liveGeneratedKey = liveGeneration?.generatedPhotoKeys?.[0]
    || (liveGeneration?.generatedImageUrls?.[0] ? extractKeyFromUrl(liveGeneration.generatedImageUrls[0]) : null)
  const liveAcceptedKey = liveGeneration?.acceptedPhotoKey || null

  // Log key extraction for debugging
  if (liveGeneration?.generatedImageUrls?.[0] && !liveGeneratedKey) {
    console.warn('Failed to get key from generation response:', {
      generatedPhotoKeys: liveGeneration?.generatedPhotoKeys,
      generatedImageUrls: liveGeneration?.generatedImageUrls
    })
  }

  // Use live keys when available, otherwise fall back to static item data
  // Also check if we have URLs but extraction failed - in that case, we can still use the URL directly
  const hasGeneratedImageUrl = liveGeneration?.generatedImageUrls?.[0] && !liveGeneratedKey
  const effectiveGeneratedKey = liveGeneratedKey || item.generatedKey
  const effectiveAcceptedKey = liveAcceptedKey || item.acceptedKey
  const afterKey = effectiveAcceptedKey || effectiveGeneratedKey || item.uploadedKey
  const normalizedAfterKey = afterKey && afterKey !== 'undefined' ? afterKey : null
  const imageKey = effectiveAcceptedKey || effectiveGeneratedKey

  const isFailed = currentStatus === 'failed' && !failedGenerationHidden
  // A generation is incomplete if:
  // 1. Status is pending or processing, OR
  // 2. Status is completed but we don't have the generated keys yet (race condition during completion)
  //    However, if we have a generatedImageUrl (even if extraction failed), we're not waiting anymore
  const isWaitingForKeys = currentStatus === 'completed' && !effectiveGeneratedKey && !effectiveAcceptedKey && !hasGeneratedImageUrl && !isFailed
  const isIncomplete = (currentStatus === 'pending' || currentStatus === 'processing') || isWaitingForKeys
  const [timedProgressPercent, setTimedProgressPercent] = useState(0)
  const realProgressValue = normalizeProgressPercent(currentJobStatus?.progress)
  const realProgressMilestone = realProgressValue === null
    ? null
    : Math.floor(realProgressValue / PROGRESS_MILESTONE_STEP) * PROGRESS_MILESTONE_STEP
  const progressTheme = getProgressTheme(item.id)
  const runnerHash = getStableHash(`${item.id}-runner`)
  const isFemaleRunner = runnerHash % 2 === 0
  const runnerTargetAnimal = (runnerHash >> 1) % 2 === 0 ? '🐶' : '🐱'
  const showRunnerTargetHeart = (runnerHash >> 2) % 3 === 0
  const butterflyFlower = ['🌸', '🌺', '🌼'][runnerHash % 3]
  const segmentRef = useRef<{ milestone: number | null, startTime: number }>({ milestone: null, startTime: 0 })
  const generationStartRef = useRef<number | null>(null)

  // Debug logging for race condition investigation
  useEffect(() => {
    if (currentStatus === 'completed') {
      console.log('[GenerationCard] Completed generation state:', {
        generationId: item.id,
        currentStatus,
        hasLiveGeneration: !!liveGeneration,
        liveGeneratedImageUrls: liveGeneration?.generatedImageUrls,
        itemGeneratedKey: item.generatedKey,
        itemAcceptedKey: item.acceptedKey,
        effectiveGeneratedKey,
        effectiveAcceptedKey,
        hasGeneratedImageUrl,
        isWaitingForKeys,
        jobProgress: currentJobStatus?.progress
      })
    }
  }, [currentStatus, liveGeneration, item.id, item.generatedKey, item.acceptedKey, effectiveGeneratedKey, effectiveAcceptedKey, hasGeneratedImageUrl, isWaitingForKeys, currentJobStatus?.progress])

  // Force re-render when keys or URLs become available to fix race condition
  // This ensures the component detects when data arrives even if polling has stopped
  useEffect(() => {
    if (currentStatus === 'completed' && (effectiveGeneratedKey || effectiveAcceptedKey || hasGeneratedImageUrl)) {
      // Data just became available - ensure we're not stuck in waiting state
      // Reset loaded state to trigger proper rendering
      if (isWaitingForKeys) {
        setLoadedGenerated(false)
      }
    }
  }, [currentStatus, effectiveGeneratedKey, effectiveAcceptedKey, hasGeneratedImageUrl, isWaitingForKeys])

  useEffect(() => {
    if (!isIncomplete) {
      setTimedProgressPercent(0)
      segmentRef.current = { milestone: null, startTime: 0 }
      generationStartRef.current = null
      return
    }

    if (isWaitingForKeys) {
      setTimedProgressPercent(100)
      segmentRef.current = { milestone: 100, startTime: Date.now() }
      return
    }

    if (generationStartRef.current === null) {
      const createdAtMs = Date.parse(item.createdAt)
      generationStartRef.current = Number.isNaN(createdAtMs) ? Date.now() : createdAtMs
    }
    const generationStartTime = generationStartRef.current
    if (segmentRef.current.milestone !== realProgressValue) {
      segmentRef.current = { milestone: realProgressValue, startTime: Date.now() }
    }

    const updateTimedProgress = () => {
      const elapsed = Date.now() - generationStartTime
      const elapsedPercent = Math.max(0, Math.min(100, (elapsed / TIMED_PROGRESS_DURATION_MS) * 100))
      const milestone = realProgressValue

      const { targetPercent, nextMilestone } = (() => {
        if (milestone === null) return { targetPercent: elapsedPercent, nextMilestone: null as number | null }

        const resolvedNextMilestone = getNextMilestone(milestone)
        if (resolvedNextMilestone <= milestone) {
          return { targetPercent: milestone, nextMilestone: resolvedNextMilestone }
        }

        const segmentRange = resolvedNextMilestone - milestone
        const segmentDurationMs = Math.max(18_000, TIMED_PROGRESS_DURATION_MS * (segmentRange / 60))
        const segmentElapsedMs = Math.max(0, Date.now() - segmentRef.current.startTime)
        const initialSegmentProgress = Math.min(1, segmentElapsedMs / segmentDurationMs)
        const easedInitialProgress = easeInOutCubic(initialSegmentProgress)
        // Keep creeping toward (but never crossing) the next milestone during long phases.
        const creepingFactor = 1 - Math.exp(-segmentElapsedMs / segmentDurationMs)
        const compositeProgress = Math.max(easedInitialProgress * 0.6, creepingFactor)
        const towardNextMilestone = milestone + (segmentRange * compositeProgress * 0.96)
        return {
          targetPercent: Math.max(milestone, Math.min(towardNextMilestone, resolvedNextMilestone)),
          nextMilestone: resolvedNextMilestone
        }
      })()

      setTimedProgressPercent(prev => {
        if (milestone !== null && prev < milestone) return milestone

        let nextValue = prev
        if (targetPercent !== null && targetPercent > prev) {
          const delta = targetPercent - prev
          const nearTarget = delta < 0.8
          const smoothing = nearTarget ? 0.2 : 0.35
          nextValue = Math.min(targetPercent, prev + (delta * smoothing))
        }

        // Safety creep: keep visible forward motion toward next milestone.
        if (nextMilestone !== null && milestone !== null && nextMilestone > milestone) {
          const segmentRange = nextMilestone - milestone
          const ticksPerTimeline = TIMED_PROGRESS_DURATION_MS / 500
          const minStepPerTick = Math.max(0.04, (segmentRange / ticksPerTimeline) * 0.8)
          const ceiling = nextMilestone - 0.35
          const creeped = Math.min(ceiling, prev + minStepPerTick)
          nextValue = Math.max(nextValue, creeped)
        }

        return nextValue
      })
    }

    updateTimedProgress()
    const intervalId = window.setInterval(updateTimedProgress, 500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isIncomplete, isWaitingForKeys, item.createdAt, realProgressMilestone, realProgressValue])

  // Add timeout for waiting for keys to prevent infinite spinner
  // If we've been waiting for more than 5 seconds, force a page reload to get fresh data
  // This handles edge cases where polling stopped but data is available
  useEffect(() => {
    if (isWaitingForKeys) {
      console.log('[GenerationCard] Started waiting for keys, setting 5s timeout', { generationId: item.id })
      // Clear any existing timeout
      if (waitingForKeysTimeoutRef.current) {
        clearTimeout(waitingForKeysTimeoutRef.current)
      }
      // Set a timeout to force refresh after 5 seconds
      // This prevents infinite spinner if polling stopped prematurely
      waitingForKeysTimeoutRef.current = setTimeout(() => {
        console.warn('[GenerationCard] Timeout waiting for keys, forcing page reload', {
          generationId: item.id,
          currentStatus,
          hasLiveGeneration: !!liveGeneration,
          liveUrls: liveGeneration?.generatedImageUrls
        })
        // Force a full page reload to get fresh data from the server
        window.location.reload()
      }, 5000) // 5 seconds timeout

      return () => {
        if (waitingForKeysTimeoutRef.current) {
          clearTimeout(waitingForKeysTimeoutRef.current)
        }
      }
    } else {
      // Clear timeout if we're no longer waiting
      if (waitingForKeysTimeoutRef.current) {
        clearTimeout(waitingForKeysTimeoutRef.current)
        waitingForKeysTimeoutRef.current = null
      }
    }
  }, [isWaitingForKeys, item.id, currentStatus, liveGeneration])

  // Update pos when live generation status changes
  useEffect(() => {
    if (currentStatus === 'completed' && isWaitingForKeys) {
      // Status is completed but we're still waiting for the generated keys
      // Show 100% progress to indicate completion, even though keys aren't available yet
      setPos(100)
    } else if (isIncomplete) {
      // Show at least 10% progress when processing to ensure spinner is visible
      setPos(Math.max(currentJobStatus?.progress || 0, 10))
    } else {
      setPos(100)
    }
  }, [isIncomplete, isWaitingForKeys, currentStatus, currentJobStatus?.progress])

  // Force re-render when live generation completes to show the image
  // Auto-hide failed generations after 10 seconds
  useEffect(() => {
    if (isFailed && !failedGenerationHidden) {
      // Set timeout to hide the failed generation after 10 seconds
      failedGenerationTimeoutRef.current = setTimeout(() => {
        setFailedGenerationHidden(true)
      }, 10000) // 10 seconds

      return () => {
        if (failedGenerationTimeoutRef.current) {
          clearTimeout(failedGenerationTimeoutRef.current)
        }
      }
    }
  }, [isFailed, failedGenerationHidden])

  useEffect(() => {
    setBeforeImageError(false)
    setBeforeRetryCount(0)
  }, [normalizedBeforeKey])

  // Reset image loading state ONLY when the actual image key changes to a different value
  // We use a ref to track the previous key and compare by value, not reference.
  // This prevents unnecessary resets when:
  // - liveGeneration becomes null but item.generatedKey has the same value
  // - hasGeneratedImageUrl changes but the underlying image is the same
  // - Array references change but contents are identical
  useEffect(() => {
    const keyActuallyChanged = previousAfterKeyRef.current !== null &&
      previousAfterKeyRef.current !== normalizedAfterKey

    if (keyActuallyChanged) {
      // Key changed to a different value - reset loading state
      setAfterImageError(false)
      setAfterRetryCount(0)
      setLoadedGenerated(false)
    }

    // Always update the ref to track current key
    previousAfterKeyRef.current = normalizedAfterKey
  }, [normalizedAfterKey])

  const beforeSrc = normalizedBeforeKey && !beforeImageError
    ? buildImageUrl(normalizedBeforeKey, beforeRetryCount, token)
    : '/placeholder-image.png'
  // If we have a generatedImageUrl but key extraction failed, use the URL directly
  const afterSrc = (normalizedAfterKey && !afterImageError)
    ? buildImageUrl(normalizedAfterKey, afterRetryCount, token)
    : (hasGeneratedImageUrl && liveGeneration?.generatedImageUrls?.[0])
      ? liveGeneration.generatedImageUrls[0] + (token ? `&token=${encodeURIComponent(token)}` : '')
      : '/placeholder-image.png'

  // Check if image is already loaded (cached) after render
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalHeight !== 0) {
      setLoadedGenerated(true)
    }
  }, [afterSrc])

  // Timeout to force hide spinner if image doesn't load within 15 seconds
  // This prevents the spinner from staying forever if the image request hangs
  const imageLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    // Only set timeout when we have a valid image URL and are not yet loaded
    if (!isIncomplete && afterSrc && afterSrc !== '/placeholder-image.png' && !loadedGenerated) {
      // Clear any existing timeout
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current)
      }
      // Set a 15-second timeout to force show the image (or error state)
      imageLoadTimeoutRef.current = setTimeout(() => {
        console.warn('[GenerationCard] Image load timeout reached, forcing display', {
          generationId: item.id,
          afterSrc
        })
        setLoadedGenerated(true)
      }, 15000)

      return () => {
        if (imageLoadTimeoutRef.current) {
          clearTimeout(imageLoadTimeoutRef.current)
          imageLoadTimeoutRef.current = null
        }
      }
    }
  }, [isIncomplete, afterSrc, loadedGenerated, item.id])

  const containerRef = useRef<HTMLDivElement | null>(null)
  // Start fully on Generated side by default (if present)
  const [pos, setPos] = useState(() => isIncomplete ? (currentJobStatus?.progress || 10) : 100) // handle position from left (0-100); 100 = Generated only
  const draggingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const photoContainerRef = useRef<HTMLDivElement>(null) // Ref for the photo container
  const [showInfoPopover, setShowInfoPopover] = useState(false)
  const [infoPopoverPosition, setInfoPopoverPosition] = useState({ top: 0, left: 0 })
  const [infoPopoverPlacement, setInfoPopoverPlacement] = useState<'top' | 'bottom'>('bottom')
  const infoButtonRef = useRef<HTMLButtonElement | null>(null)
  const infoPopoverRef = useRef<HTMLDivElement | null>(null)

  const updateInfoPopoverPosition = () => {
    const buttonEl = infoButtonRef.current
    if (!buttonEl) return

    const buttonRect = buttonEl.getBoundingClientRect()
    const popoverEl = infoPopoverRef.current
    const popoverWidth = popoverEl?.offsetWidth ?? 256
    const popoverHeight = popoverEl?.offsetHeight ?? 140
    const viewportPadding = 8
    const gap = 8

    let left = buttonRect.left
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popoverWidth - viewportPadding))

    let top = buttonRect.bottom + gap
    let placement: 'top' | 'bottom' = 'bottom'
    if (top + popoverHeight + viewportPadding > window.innerHeight) {
      top = buttonRect.top - popoverHeight - gap
      placement = 'top'
    }
    top = Math.max(viewportPadding, top)

    setInfoPopoverPosition({ top, left })
    setInfoPopoverPlacement(placement)
  }

  // Emit custom event when generated image is loaded (for tour triggering)
  useEffect(() => {
    if (loadedGenerated && currentStatus === 'completed' && !isIncomplete) {
      // Dispatch a custom event that can be listened to by parent components
      const event = new CustomEvent('generationImageLoaded', {
        detail: { generationId: item.id },
        bubbles: true,
      })
      window.dispatchEvent(event)
    }
  }, [loadedGenerated, currentStatus, isIncomplete, item.id])

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRegenerating) return

    // Track regenerate click
    trackRegenerateClicked({
      generation_id: item.id,
      reason: 'user_initiated'
    })

    setIsRegenerating(true)
    try {
      // Use token-based API if token is provided, otherwise use session-based API
      const apiUrl = token
        ? `/api/team/member/generations/regenerate?token=${encodeURIComponent(token)}`
        : '/api/generations/create'

      const body = token
        ? JSON.stringify({ generationId: item.id })
        : JSON.stringify({
          contextId: item.contextId,
          prompt: t('actions.retryPrompt'),
          generationType: item.generationType,
          isRegeneration: true,
          originalGenerationId: item.id,
          workflowVersion: 'v3', // Use V3 workflow (4-step with parallel person/background generation)
        })

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('actions.retryFailed'))
      }

      await response.json()

      // Optionally refresh the page or show success message
      window.location.reload()
    } catch (error) {
      console.error('Failed to retry:', error)
      alert(t('actions.retryFailedMessage'))
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Only show confirmation dialog for original photos with regenerations left
    // For regenerated images or originals with 0 regenerations, delete directly
    if (item.isOriginal && item.remainingRegenerations > 0) {
      setShowDeleteDialog(true)
    } else {
      handleDeleteConfirm()
    }
  }

  const handleDeleteConfirm = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    try {
      // Use token-based API if token is provided, otherwise use session-based API
      const apiUrl = token
        ? `/api/team/member/generations/${item.id}?token=${encodeURIComponent(token)}`
        : `/api/generations/${item.id}`

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete generation')
      }

      // Refresh the page to update the list
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete generation:', error)
      alert('Failed to delete generation. Please try again.')
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }

  // Check if generation is incomplete
  // isIncomplete is now defined above with live data

  const updateFromEvent = (clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    setPos(Math.round((x / rect.width) * 100))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = true
    updateFromEvent(e.clientX)
  }
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = true
    updateFromEvent(e.touches[0].clientX)
  }

  const determineScrollability = () => {
    const el = scrollContainerRef.current
    if (!el) {
      setCanScrollDown(false)
      return
    }
    const more = el.scrollHeight - el.scrollTop - el.clientHeight > 1
    setCanScrollDown(more)
  }

  // Global mouse/touch handlers for dragging (only active when dragging)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      updateFromEvent(e.clientX)
    }
    const handleGlobalMouseUp = () => {
      draggingRef.current = false
    }
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      updateFromEvent(e.touches[0].clientX)
    }
    const handleGlobalTouchEnd = () => {
      draggingRef.current = false
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
    document.addEventListener('touchend', handleGlobalTouchEnd)
    document.addEventListener('touchcancel', handleGlobalTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('touchmove', handleGlobalTouchMove)
      document.removeEventListener('touchend', handleGlobalTouchEnd)
      document.removeEventListener('touchcancel', handleGlobalTouchEnd)
    }
  }, []) // updateFromEvent uses refs, so it's stable

  useEffect(() => {
    if (!showInfoPopover) return

    updateInfoPopoverPosition()

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        infoButtonRef.current?.contains(target) ||
        infoPopoverRef.current?.contains(target)
      ) {
        return
      }
      setShowInfoPopover(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInfoPopover(false)
      }
    }

    const handleReposition = () => {
      updateInfoPopoverPosition()
    }

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showInfoPopover])

  useEffect(() => {
    if (isIncomplete || isFailed) {
      setShowInfoPopover(false)
    }
  }, [isIncomplete, isFailed])

  // Don't render if failed generation has been hidden
  if (failedGenerationHidden && currentStatus === 'failed') {
    return null
  }

  // Get the displayable image URL for lightbox
  const getDisplayImageUrl = () => {
    if (effectiveAcceptedKey) return buildImageUrl(effectiveAcceptedKey, afterRetryCount, token)
    if (effectiveGeneratedKey) return buildImageUrl(effectiveGeneratedKey, afterRetryCount, token)
    if (hasGeneratedImageUrl && liveGeneration?.generatedImageUrls?.[0]) {
      return liveGeneration.generatedImageUrls[0] + (token ? `&token=${encodeURIComponent(token)}` : '')
    }
    return null
  }

  const progressCharacter = progressTheme === 'runner'
    ? (isFemaleRunner ? '🏃‍♀️' : '🏃‍♂️')
    : progressTheme === 'butterfly'
      ? '🦋'
      : timedProgressPercent < 35
        ? '🐱'
        : timedProgressPercent < 70
          ? '🐯'
          : '🦁'

  const progressCharacterLeft = Math.max(2, Math.min(98, timedProgressPercent))
  const rawGenerationMessage = compactProgressMessage(stripProgressPercentage(currentJobStatus?.message))
  const displayedWorkflowStep = extractWorkflowStepFromMessage(rawGenerationMessage)
  const inferredWorkflowStep = inferWorkflowStepFromProgress(currentJobStatus?.progress)
  const generationMessage = (
    inferredWorkflowStep !== null
      && displayedWorkflowStep !== null
      && displayedWorkflowStep < inferredWorkflowStep
  )
    ? FALLBACK_WORKFLOW_MESSAGES[inferredWorkflowStep]
    : rawGenerationMessage || (
      inferredWorkflowStep !== null
        ? FALLBACK_WORKFLOW_MESSAGES[inferredWorkflowStep]
        : t('generating', { default: 'Generating...' })
    )
  const nextMilestoneForPulse = realProgressValue === null ? null : getNextMilestone(realProgressValue)
  const milestoneRangeForPulse = (realProgressValue !== null && nextMilestoneForPulse !== null)
    ? Math.max(1, nextMilestoneForPulse - realProgressValue)
    : null
  const isPlateauingNearMilestone = !isWaitingForKeys
    && realProgressValue !== null
    && nextMilestoneForPulse !== null
    && nextMilestoneForPulse > realProgressValue
    && milestoneRangeForPulse !== null
    && timedProgressPercent >= (realProgressValue + (milestoneRangeForPulse * 0.75))

  return (
    <div
      className="relative rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-t-lg cursor-pointer"
        ref={photoContainerRef}
        onClick={() => {
          // Robust image URL retrieval with fallback for live generations
          const basicUrl = getDisplayImageUrl()
          const imageUrl = basicUrl || (liveGeneration?.generatedImageUrls?.[0] ?
            (liveGeneration.generatedImageUrls[0] + (token ? `&token=${encodeURIComponent(token)}` : '')) : null)

          if (imageUrl && onImageClick && !isIncomplete && !isFailed) {
            onImageClick(imageUrl)
          }
        }}
      >
        {/* Image container */}
        <div
          ref={containerRef}
          className="absolute inset-0 bg-gray-50 overflow-hidden select-none"
        >
          {/* BACKGROUND: Single selfie or collage of multiple input selfies */}
          {!isIncomplete && (Array.isArray(item.inputSelfieUrls) && item.inputSelfieUrls.length > 1 ? (
            <div className="absolute inset-0 grid bg-gray-200"
              style={{
                gridTemplateColumns: item.inputSelfieUrls.length <= 2 ? 'repeat(2, 1fr)'
                  : item.inputSelfieUrls.length <= 4 ? 'repeat(2, 1fr)'
                    : item.inputSelfieUrls.length <= 6 ? 'repeat(3, 1fr)'
                      : 'repeat(3, 1fr)',
                gridTemplateRows: item.inputSelfieUrls.length <= 2 ? 'repeat(1, 1fr)'
                  : item.inputSelfieUrls.length <= 4 ? 'repeat(2, 1fr)'
                    : item.inputSelfieUrls.length <= 6 ? 'repeat(2, 1fr)'
                      : 'repeat(3, 1fr)'
              }}
            >
              {item.inputSelfieUrls.slice(0, 9).map((url, idx) => (
                <div key={`${item.id}-input-${idx}`} className="relative overflow-hidden">
                  <Image
                    src={url}
                    alt="input selfie"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : (
            <Image
              src={beforeSrc}
              alt="selfie"
              fill
              className="object-cover"
              unoptimized
              onError={() => {
                if (beforeRetryCount < MAX_IMAGE_RETRY_ATTEMPTS) {
                  setBeforeRetryCount(prev => prev + 1)
                  return
                }
                setBeforeImageError(true)
                console.warn('Selfie image failed to load, may not be migrated to Backblaze yet:', item.uploadedKey)
              }}
              onLoadingComplete={() => {
                if (beforeRetryCount !== 0) {
                  setBeforeRetryCount(0)
                }
              }}
            />
          ))}

          {/* FOREGROUND: Generated clipped to handle position OR placeholder */}
          {isFailed ? (
            // Error state for failed generation
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="mx-auto mb-3">
                  <svg className="w-12 h-12 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {t('toasts.generationFailed', { default: 'We couldn\'t finish that photo. The photo credits have been returned to your balance.' })}
                </p>
                {currentJobStatus?.failedReason && (
                  <p className="text-xs text-gray-500 mt-2">
                    {currentJobStatus.failedReason}
                  </p>
                )}
              </div>
            </div>
          ) : isWaitingForKeys ? (
            // Status is completed but waiting for image keys to arrive
            <div className="absolute inset-0 z-20 bg-gray-100 flex items-center justify-center relative">
              <div className="text-center px-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 whitespace-pre-line">
                  {t('finalizing', { default: 'Finalizing...' })}
                </p>
              </div>
            </div>
          ) : isIncomplete ? (
            // Placeholder for incomplete generation - show full spinner
            <div className="absolute inset-0 z-20 bg-gray-100 flex items-center justify-center relative">
              <div className="text-center px-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 whitespace-pre-line">
                  {generationMessage}
                </p>
              </div>
            </div>
          ) : (
            // Generated image with progress reveal
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            >
              <div
                ref={scrollContainerRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden relative"
                onScroll={determineScrollability}
              >
                {/* Loading spinner overlay */}
                {!loadedGenerated && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 z-10">
                    <LoadingSpinner />
                  </div>
                )}
                {/* Use native img for flexible intrinsic sizing and scrolling */}
                {/* Scale to container width; allow vertical scroll if taller than square */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={afterSrc}
                  alt="generated"
                  className="block w-full h-auto"
                  id={`generated-photo-${item.id}`}
                  data-onborda="generated-photo"
                  onLoad={() => {
                    setLoadedGenerated(true)
                    if (afterRetryCount !== 0) {
                      setAfterRetryCount(0)
                    }
                    // Measure after image lays out
                    requestAnimationFrame(determineScrollability)
                  }}
                  // NOTE: onLoadStart is NOT a valid event for <img> elements (only for video/audio/XHR)
                  // React may silently ignore it or cause unexpected behavior, so we removed it.
                  // The loadedGenerated state is now managed purely through the effect and onLoad.
                  onError={() => {
                    if (afterRetryCount < MAX_IMAGE_RETRY_ATTEMPTS) {
                      setAfterRetryCount(prev => prev + 1)
                      return
                    }
                    setAfterImageError(true)
                    setLoadedGenerated(true) // Hide spinner on error too
                    console.warn('Generated image failed to load, may not be migrated to Backblaze yet:', item.generatedKey)
                  }}
                />
              </div>
            </div>
          )}

          {/* Timed progress bar - always docked at the bottom while generating */}
          {isIncomplete && !isFailed && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-2 pb-2">
              <div className="relative h-4">
                <div className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-full bg-gray-300/70">
                  <div
                    className="h-full bg-brand-primary transition-[width] duration-500 ease-linear"
                    style={{ width: `${timedProgressPercent}%` }}
                  />
                  {isPlateauingNearMilestone && (
                    <span
                      className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/70 animate-ping"
                      style={{ left: `${progressCharacterLeft}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span
                  className={`pointer-events-none absolute bottom-0 -translate-x-1/2 -translate-y-[55%] text-[13px] leading-none ${
                    progressTheme === 'butterfly'
                      ? 'animate-bounce'
                      : (isPlateauingNearMilestone ? 'animate-pulse' : '')
                  }`}
                  style={{
                    left: `${progressCharacterLeft}%`,
                    transform: progressTheme === 'runner'
                      ? 'translateX(-50%) translateY(-55%) scaleX(-1)'
                      : 'translateX(-50%) translateY(-55%)',
                  }}
                >
                  {progressCharacter}
                </span>
                {progressTheme === 'runner' && (
                  <span
                    className={`pointer-events-none absolute bottom-0 right-0 translate-y-[-55%] text-[12px] leading-none ${
                      isPlateauingNearMilestone ? 'animate-pulse' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {showRunnerTargetHeart ? `${runnerTargetAnimal}❤️` : runnerTargetAnimal}
                  </span>
                )}
                {progressTheme === 'butterfly' && (
                  <span
                    className={`pointer-events-none absolute bottom-0 right-0 translate-y-[-55%] text-[12px] leading-none ${
                      isPlateauingNearMilestone ? 'animate-pulse' : ''
                    }`}
                    style={{ right: '2px', fontSize: '15px' }}
                    aria-hidden="true"
                  >
                    {butterflyFlower}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Scroll hint arrow when content overflows */}
          {!isIncomplete && canScrollDown && (
            <button
              onClick={() => {
                const el = scrollContainerRef.current
                if (el) {
                  el.scrollBy({ top: 100, behavior: 'smooth' })
                }
              }}
              className="absolute bottom-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow p-1 cursor-pointer transition-colors animate-bounce"
              aria-label="Scroll down"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}

          {/* Handle knob (also used to start drag) - only show if not incomplete */}
          {!isIncomplete && (
            <button
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-xs z-10"
              style={{ left: `${pos}%` }}
              aria-label="Drag slider"
              id={`slider-button-${item.id}`}
            >
              ⇆
            </button>
          )}

          {/* Processing label - only shown during generation */}
          {isIncomplete && (
            <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-brand-cta text-white">Processing</span>
          )}

          {/* Generation Rating - Overlay on photo, only for own generations */}
          {!isIncomplete && item.isOwnGeneration && (
            <div className="absolute bottom-2 left-2 z-20" data-onborda="feedback-rating">
              <GenerationRating
                generationId={item.id}
                token={token}
                generationStatus={currentStatus}
                photoContainerRef={photoContainerRef} // Pass the ref here
              />
            </div>
          )}
        </div>
      </div>

      {/* Info icon with floating popover rendered in a portal */}
      {!isIncomplete && !isFailed && (
        <div className="absolute top-2 left-2 z-30">
          <button
            ref={infoButtonRef}
            type="button"
            className="w-6 h-6 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setShowInfoPopover(prev => !prev)
            }}
            aria-haspopup="dialog"
            aria-expanded={showInfoPopover}
            aria-label="View generation details"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      )}

      {showInfoPopover && typeof document !== 'undefined' && createPortal(
        <div
          ref={infoPopoverRef}
          role="dialog"
          aria-label="Generation details"
          className="w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[10001]"
          style={{
            position: 'fixed',
            top: infoPopoverPosition.top,
            left: infoPopoverPosition.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Generated by:</span>
              <span className="font-medium text-gray-700">
                {item.generationType === 'team' ? (
                  item.isOwnGeneration || item.personUserId === currentUserId
                    ? t('generatedBy.you')
                    : item.personFirstName || 'Team member'
                ) : t('generatedBy.you')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date:</span>
              <span className="font-medium text-gray-700">{formatDate(item.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Photo style:</span>
              <span className="font-medium text-gray-700">{item.contextName || 'Freestyle'}</span>
            </div>
          </div>
          <div
            className={`absolute left-3 w-2 h-2 bg-white border-gray-200 transform rotate-45 ${
              infoPopoverPlacement === 'bottom'
                ? '-top-1 border-l border-t'
                : '-bottom-1 border-r border-b'
            }`}
          />
        </div>,
        document.body
      )}

      <div className="p-3 pb-4">
        <div className="flex items-center justify-between" data-onborda="photos-info">
          {/* Action buttons - moved to top */}
          <div className="flex items-center gap-1 relative" data-onborda="action-buttons">
            {isIncomplete ? (
              <span className="text-sm text-gray-500">Processing...</span>
            ) : (
              <>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!imageKey) return
                    try {
                      const downloadUrl = buildImageUrl(imageKey, 0, token)
                      const response = await fetch(downloadUrl)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `generated-photo-${item.id}.png`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      window.URL.revokeObjectURL(url)

                      // Track successful download
                      trackPhotoDownloaded({
                        generation_id: item.id,
                        format: 'png'
                      })
                    } catch (error) {
                      console.error('Download failed:', error)
                      alert('Download failed. Please try again.')
                    }
                  }}
                  className="relative group text-sm text-brand-primary hover:text-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-brand-primary-light transition-colors"
                  id={`download-button-${item.id}`}
                  data-onborda="download-button"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {/* Popover tooltip */}
                  <div className="absolute bottom-full left-0 transform -translate-x-2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {t('actions.download')}
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </button>
                {item.remainingRegenerations > 0 && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="relative group text-sm text-brand-secondary hover:text-brand-secondary-hover disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-brand-secondary/10 transition-colors"
                    id={`regenerate-button-${item.id}`}
                    data-onborda="regenerate-button"
                  >
                    {isRegenerating ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-brand-secondary"></div>
                      </div>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                    {/* Popover tooltip */}
                    <div className="absolute bottom-full left-0 transform -translate-x-2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {isRegenerating ? t('actions.retrying') : `${t('actions.regenerate')} (${item.remainingRegenerations} left)`}
                      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </button>
                )}
                {/* Only show delete button if user owns this generation */}
                {item.isOwnGeneration === true && (
                  <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="relative group text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 transition-colors"
                    id={`delete-button-${item.id}`}
                    data-onborda="delete-button"
                  >
                    {isDeleting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                      </div>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                    {/* Popover tooltip */}
                    <div className="absolute bottom-full left-0 transform -translate-x-2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {isDeleting ? 'Deleting...' : 'Delete generation'}
                      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Retries info - moved to right side */}
          <div className="text-xs text-gray-500" id={`photos-info-${item.id}`}>
            {item.remainingRegenerations > 0 && (
              <span className="text-brand-secondary" data-onborda="regenerations-info">
                {t('actions.retriesLeft', { count: item.remainingRegenerations })}
              </span>
            )}
            {item.remainingRegenerations === 0 && (
              <span className="text-gray-400" data-onborda="regenerations-info">
                {item.isOriginal ? t('actions.noRetriesLeft') : t('actions.retriedPhoto')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        remainingRegenerations={item.remainingRegenerations}
        isDeleting={isDeleting}
      />
    </div>
  )
}
