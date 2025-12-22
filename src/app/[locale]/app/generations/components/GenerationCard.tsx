"use client"

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'
import { LoadingSpinner } from '@/components/ui'
import { GenerationRating } from '@/components/feedback/GenerationRating'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useGenerationStatus } from '../hooks/useGenerationStatus'
import { DeleteConfirmationDialog } from '@/components/generation/DeleteConfirmationDialog'

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

export default function GenerationCard({ item, currentUserId, token }: { item: GenerationListItem; currentUserId?: string; token?: string }) {
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
      if (key) return decodeURIComponent(key)
    } catch (error) {
      console.warn('Failed to parse URL, trying regex extraction:', url, error)
    }
    // If URL parsing fails, try to extract key directly from query string
    const match = url.match(/[?&]key=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }
  
  // Get generated key from live generation or fall back to item
  // The API returns generatedImageUrls as proxy URLs, extract the key to build the correct URL
  const liveGeneratedKey = liveGeneration?.generatedImageUrls?.[0] 
    ? extractKeyFromUrl(liveGeneration.generatedImageUrls[0])
    : null
  const liveAcceptedKey = liveGeneration?.acceptedPhotoKey || null
  
  // Log key extraction for debugging
  if (liveGeneration?.generatedImageUrls?.[0] && !liveGeneratedKey) {
    console.warn('Failed to extract key from generatedImageUrl:', liveGeneration.generatedImageUrls[0])
  }
  
  // Use live keys when available, otherwise fall back to static item data
  const effectiveGeneratedKey = liveGeneratedKey || item.generatedKey
  const effectiveAcceptedKey = liveAcceptedKey || item.acceptedKey
  const afterKey = effectiveAcceptedKey || effectiveGeneratedKey || item.uploadedKey
  const normalizedAfterKey = afterKey && afterKey !== 'undefined' ? afterKey : null
  const imageKey = effectiveAcceptedKey || effectiveGeneratedKey

  const isFailed = currentStatus === 'failed' && !failedGenerationHidden
  const isIncomplete = (currentStatus === 'pending' || currentStatus === 'processing') || (!effectiveGeneratedKey && !effectiveAcceptedKey && !isFailed)

  // Update pos when live generation status changes
  useEffect(() => {
    if (isIncomplete) {
      // Show at least 10% progress when processing to ensure spinner is visible
      setPos(Math.max(currentJobStatus?.progress || 0, 10))
    } else {
      setPos(100)
    }
  }, [isIncomplete, currentJobStatus?.progress])

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

  useEffect(() => {
    setAfterImageError(false)
    setAfterRetryCount(0)
    setLoadedGenerated(false)
  }, [normalizedAfterKey])

  const beforeSrc = normalizedBeforeKey && !beforeImageError
    ? buildImageUrl(normalizedBeforeKey, beforeRetryCount, token)
    : '/placeholder-image.png'
  const afterSrc = normalizedAfterKey && !afterImageError
    ? buildImageUrl(normalizedAfterKey, afterRetryCount, token)
    : '/placeholder-image.png'

  // Check if image is already loaded (cached) after render
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalHeight !== 0) {
      setLoadedGenerated(true)
    }
  }, [afterSrc])
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Start fully on Generated side by default (if present)
  const [pos, setPos] = useState(() => isIncomplete ? (currentJobStatus?.progress || 10) : 100) // handle position from left (0-100); 100 = Generated only
  const draggingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const photoContainerRef = useRef<HTMLDivElement>(null) // Ref for the photo container

  const handleRegenerate = async () => {
    if (isRegenerating) return
    
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

  const handleDeleteClick = () => {
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

  // Don't render if failed generation has been hidden
  if (failedGenerationHidden && currentStatus === 'failed') {
    return null
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        <div className="relative aspect-square" ref={photoContainerRef}>
        {/* Image container */}
        <div
          ref={containerRef}
          className="absolute inset-0 bg-gray-50 overflow-hidden select-none"
        >
        {/* BACKGROUND: Single selfie or collage of multiple input selfies */}
        {Array.isArray(item.inputSelfieUrls) && item.inputSelfieUrls.length > 1 ? (
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
        )}

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
        ) : isIncomplete ? (
          // Placeholder for incomplete generation - show full spinner
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
              <p className="text-xs text-gray-600 whitespace-pre-line">
                {currentJobStatus?.message || t('generating', { default: 'Generating...' })}
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
              onLoadStart={() => {
                // Reset loading state when a new load starts
                setLoadedGenerated(false)
              }}
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

        {/* Labels: switch based on handle position or show processing */}
        {isIncomplete ? (
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-brand-cta text-white">Processing</span>
        ) : pos <= 50 ? (
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-gray-900/80 text-white">Selfie</span>
        ) : (
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded bg-brand-primary text-white">Generated</span>
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
      <div className="p-3 space-y-2 pb-6">
        <div className="flex items-center justify-between">
          {/* Show "Generated by" label for team generations */}
          {item.generationType === 'team' ? (
            <span className="text-sm text-brand-primary font-medium">
              {item.isOwnGeneration || item.personUserId === currentUserId
                ? t('generatedBy.you')
                : (
                    <>
                      {t('generatedBy.prefix')}{' '}
                      <span className="font-bold">{item.personFirstName || 'Team member'}</span>
                    </>
                  )}
            </span>
          ) : (
            <span></span>
          )}
          <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-900 truncate">Photo style: {item.contextName || 'Freestyle'}</p>
        <div className="flex items-center justify-between" data-onborda="photos-info">
          <div className="text-xs text-gray-500" id={`photos-info-${item.id}`}>
            {item.isOriginal && `${calculatePhotosFromCredits(item.costCredits)} photos`}
            {item.remainingRegenerations > 0 && (
              <span className="ml-2 text-brand-secondary" data-onborda="regenerations-info">
                • {t('actions.retriesLeft', { count: item.remainingRegenerations })}
              </span>
            )}
            {item.remainingRegenerations === 0 && (
              <span className={item.isOriginal ? "ml-2 text-gray-400" : "text-gray-400"} data-onborda="regenerations-info">
                {item.isOriginal ? `• ${t('actions.noRetriesLeft')}` : t('actions.retriedPhoto')}
              </span>
            )}
          </div>
            <div className="flex items-center gap-1 relative" data-onborda="action-buttons">
            {isIncomplete ? (
              <span className="text-sm text-gray-500">Processing...</span>
            ) : (
              <>
                <button 
                  onClick={async () => {
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


