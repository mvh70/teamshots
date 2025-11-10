"use client"

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'

export type GenerationListItem = {
  id: string
  selfieId?: string
  uploadedKey: string
  acceptedKey?: string
  selfieKey?: string
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
  const imageKey = item.acceptedKey || item.generatedKey
  const [beforeImageError, setBeforeImageError] = useState(false)
  const [afterImageError, setAfterImageError] = useState(false)
  const [beforeRetryCount, setBeforeRetryCount] = useState(0)
  const [afterRetryCount, setAfterRetryCount] = useState(0)
  const [loadedGenerated, setLoadedGenerated] = useState(false)
  const beforeKey = item.selfieKey || item.uploadedKey
  const afterKey = item.generatedKey || item.uploadedKey
  const normalizedBeforeKey = beforeKey && beforeKey !== 'undefined' ? beforeKey : null
  const normalizedAfterKey = afterKey && afterKey !== 'undefined' ? afterKey : null

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
  const [pos, setPos] = useState(100) // handle position from left (0-100); 100 = Generated only
  const draggingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

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
            selfieId: item.selfieId || undefined,
            selfieKey: item.selfieId ? undefined : item.uploadedKey,
            contextId: item.contextId,
            prompt: 'Regenerate with same settings',
            generationType: item.generationType,
            creditSource: 'individual',
            isRegeneration: true,
            originalGenerationId: item.id,
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
        throw new Error(errorData.error || 'Failed to regenerate')
      }

      await response.json()
      
      // Optionally refresh the page or show success message
      window.location.reload()
    } catch (error) {
      console.error('Failed to regenerate:', error)
      alert('Failed to regenerate image. Please try again.')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this generation? This action cannot be undone.')) {
      return
    }
    
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
    } finally {
      setIsDeleting(false)
    }
  }
  
  // Check if generation is incomplete
  const isIncomplete = (item.status === 'processing' || item.status === 'pending') && !item.generatedKey

  const updateFromEvent = (clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    setPos(Math.round((x / rect.width) * 100))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true
    updateFromEvent(e.clientX)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return
    updateFromEvent(e.clientX)
  }
  const onMouseUp = () => {
    draggingRef.current = false
  }
  const onTouchStart = (e: React.TouchEvent) => {
    draggingRef.current = true
    updateFromEvent(e.touches[0].clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return
    updateFromEvent(e.touches[0].clientX)
  }
  const onTouchEnd = () => {
    draggingRef.current = false
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

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div
        ref={containerRef}
        className="aspect-square bg-gray-50 overflow-hidden relative select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseUp}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onTouchMove={onTouchMove}
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
              console.warn('Selfie image failed to load, may not be migrated to Backblaze yet:', item.selfieKey || item.uploadedKey)
            }}
            onLoadingComplete={() => {
              if (beforeRetryCount !== 0) {
                setBeforeRetryCount(0)
              }
            }}
          />
        )}

        {/* FOREGROUND: Generated clipped to handle position OR placeholder */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {isIncomplete ? (
            // Placeholder for incomplete generation
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                <p className="text-xs text-gray-600">
                  {item.jobStatus?.message || t('generating', { default: 'Generating...' })}
                </p>
                {item.jobStatus?.progress !== undefined && (
                  <p className="text-[10px] text-gray-500 mt-1">{item.jobStatus.progress}%</p>
                )}
              </div>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="w-full h-full overflow-y-auto overflow-x-hidden relative"
              onScroll={determineScrollability}
            >
              {/* Loading spinner overlay */}
              {!loadedGenerated && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 z-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-brand-primary" />
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
          )}
        </div>

        {/* Scroll hint arrow when content overflows */}
        {!isIncomplete && canScrollDown && (
          <div className="absolute bottom-2 right-2 bg-white/80 text-gray-700 rounded-full shadow p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}

        {/* Handle knob (also used to start drag) - only show if not incomplete */}
        {!isIncomplete && (
          <button
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-xs"
            style={{ left: `${pos}%` }}
            aria-label="Drag slider"
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
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {item.isOriginal && `${item.costCredits} credits`}
            {item.remainingRegenerations > 0 && (
              <span className="ml-2 text-brand-secondary">
                • {item.remainingRegenerations} regenerations left
              </span>
            )}
            {item.remainingRegenerations === 0 && (
              <span className={item.isOriginal ? "ml-2 text-gray-400" : "text-gray-400"}>
                {item.isOriginal ? '• No regenerations left' : 'Regenerated photo'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 relative">
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
                      {isRegenerating ? 'Regenerating...' : `${t('actions.regenerate')} (${item.remainingRegenerations} left)`}
                      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </button>
                )}
                {/* Only show delete button if user owns this generation */}
                {item.isOwnGeneration === true && (
                  <button 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="relative group text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 transition-colors"
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
    </div>
  )
}


