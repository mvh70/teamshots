'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { formatDate } from '@/lib/format'
import { PhotoIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

interface Generation {
  id: string
  selfieKey: string
  selfieUrl: string
  generatedPhotos: Array<{
    id: string
    url: string
    style: string
  }>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  generationType: 'personal' | 'team'
  creditsUsed: number
  maxRegenerations: number
  remainingRegenerations: number
  isOriginal: boolean
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

interface GenerationContainerElement extends HTMLDivElement {
  generationId?: string
}

export default function GenerationsPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [sliderPositions, setSliderPositions] = useState<Record<string, number>>({})
  const draggingRef = useRef<string | null>(null)

  const fetchGenerations = useCallback(async () => {
    try {
      // Only show the full-page loading state on the first load to avoid flashing during auto-refresh
      if (!initialLoadDone) {
        setLoading(true)
      }
      const response = await fetch(`/api/team/member/generations?token=${token}`)
      
      if (response.ok) {
        const data = await response.json()
        setGenerations(data.generations)
      } else {
        setError('Failed to fetch generations')
      }
    } catch {
      setError('Failed to fetch generations')
    } finally {
      setLoading(false)
      if (!initialLoadDone) {
        setInitialLoadDone(true)
      }
    }
  }, [token, initialLoadDone])

  useEffect(() => {
    fetchGenerations()
  }, [fetchGenerations])

  // Auto-refresh when there are processing generations
  useEffect(() => {
    const hasProcessingGenerations = generations.some(gen => gen.status === 'processing' || gen.status === 'pending')
    
    if (hasProcessingGenerations) {
      setAutoRefreshing(true)
      const interval = setInterval(() => {
        fetchGenerations()
      }, 3000) // Check every 3 seconds

      return () => {
        clearInterval(interval)
        setAutoRefreshing(false)
      }
    } else {
      setAutoRefreshing(false)
    }
  }, [generations, fetchGenerations])

  const handleDownload = async (photoUrl: string, filename: string) => {
    try {
      const response = await fetch(photoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading photo:', error)
    }
  }

  const handleRegenerate = async (generationId: string) => {
    setRegenerating(generationId)
    try {
      const response = await fetch(`/api/team/member/generations/regenerate?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationId: generationId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate')
      }

      await response.json()
      
      // Refresh the generations list
      await fetchGenerations()
    } catch (error) {
      console.error('Failed to regenerate:', error)
      alert('Failed to regenerate image. Please try again.')
    } finally {
      setRegenerating(null)
    }
  }

  const handleDelete = async (generationId: string) => {
    if (!window.confirm('Are you sure you want to delete this generation? This action cannot be undone.')) {
      return
    }

    setDeleting(generationId)
    try {
      const response = await fetch(`/api/team/member/generations/${generationId}?token=${token}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete generation')
      }

      // Remove from local state
      setGenerations(prev => prev.filter(g => g.id !== generationId))
    } catch (error) {
      console.error('Failed to delete generation:', error)
      alert('Failed to delete image. Please try again.')
    } finally {
      setDeleting(null) // Clear deleting state
      setRegenerating(null) // Also clear regenerating state
    }
  }

  // Slider functionality
  const updateSliderPosition = (generationId: string, clientX: number, containerRef: React.RefObject<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const newPos = Math.round((x / rect.width) * 100)
    setSliderPositions(prev => ({ ...prev, [generationId]: newPos }))
  }

  const onSliderMouseDown = (generationId: string, e: React.MouseEvent, containerRef: React.RefObject<HTMLDivElement>) => {
    draggingRef.current = generationId
    updateSliderPosition(generationId, e.clientX, containerRef)
  }

  const onSliderMouseMove = (generationId: string, e: React.MouseEvent, containerRef: React.RefObject<HTMLDivElement>) => {
    if (draggingRef.current !== generationId) return
    updateSliderPosition(generationId, e.clientX, containerRef)
  }

  const onSliderMouseUp = (generationId: string) => {
    if (draggingRef.current === generationId) {
      draggingRef.current = null
    }
  }

  const onSliderTouchStart = (generationId: string, e: React.TouchEvent, containerRef: React.RefObject<HTMLDivElement>) => {
    draggingRef.current = generationId
    updateSliderPosition(generationId, e.touches[0].clientX, containerRef)
  }

  const onSliderTouchMove = (generationId: string, e: React.TouchEvent, containerRef: React.RefObject<HTMLDivElement>) => {
    if (draggingRef.current !== generationId) return
    updateSliderPosition(generationId, e.touches[0].clientX, containerRef)
  }

  const onSliderTouchEnd = (generationId: string) => {
    if (draggingRef.current === generationId) {
      draggingRef.current = null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading generations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <button
                onClick={() => router.push(`/invite-dashboard/${token}`)}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                ← Back to Dashboard
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Team Photos</h1>
                {autoRefreshing && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Auto-refreshing...</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">View and download your generated team photos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {generations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {generations.map((generation) => (
                <div key={generation.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">


                    {/* Slider for Before/After Comparison */}
                    {generation.status === 'completed' && generation.generatedPhotos.length > 0 ? (
                      <div>
                        <div className="relative">
                          <div
                            ref={(el: GenerationContainerElement | null) => {
                              if (el) {
                                el.generationId = generation.id
                              }
                            }}
                            className="aspect-square bg-gray-50 overflow-hidden relative select-none"
                            onMouseMove={(e) => onSliderMouseMove(generation.id, e, { current: e.currentTarget as HTMLDivElement })}
                            onMouseLeave={() => onSliderMouseUp(generation.id)}
                            onMouseUp={() => onSliderMouseUp(generation.id)}
                            onTouchEnd={() => onSliderTouchEnd(generation.id)}
                            onTouchCancel={() => onSliderTouchEnd(generation.id)}
                            onTouchMove={(e) => onSliderTouchMove(generation.id, e, { current: e.currentTarget as HTMLDivElement })}
                          >
                            {/* BACKGROUND: Selfie full cover */}
                            <Image 
                              src={generation.selfieUrl} 
                              alt="selfie" 
                              fill 
                              className="object-cover" 
                              unoptimized 
                            />

                            {/* FOREGROUND: Generated clipped to handle position */}
                            <div className="absolute inset-0">
                              <Image
                                src={generation.generatedPhotos[0].url}
                                alt="generated"
                                fill
                                className="object-cover"
                                unoptimized
                                style={{ clipPath: `inset(0 ${100 - (sliderPositions[generation.id] || 100)}% 0 0)` }}
                              />
                            </div>

                            {/* Handle knob */}
                            <button
                              onMouseDown={(e) => onSliderMouseDown(generation.id, e, { current: e.currentTarget.parentElement as HTMLDivElement })}
                              onTouchStart={(e) => onSliderTouchStart(generation.id, e, { current: e.currentTarget.parentElement as HTMLDivElement })}
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow border border-gray-300 flex items-center justify-center text-xs"
                              style={{ left: `${sliderPositions[generation.id] || 100}%` }}
                              aria-label="Drag slider"
                            >
                              ⇆
                            </button>

                            {/* Labels: switch based on handle position */}
                            {(sliderPositions[generation.id] || 100) <= 50 ? (
                              <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-gray-900/80 text-white">Selfie</span>
                            ) : (
                              <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded bg-brand-primary text-white">Generated</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (generation.status === 'processing' || generation.status === 'pending') ? (
                      <div className="aspect-square bg-gray-50 overflow-hidden relative">
                        <Image 
                          src={generation.selfieUrl} 
                          alt="selfie" 
                          fill 
                          className="object-cover" 
                          unoptimized 
                        />
                        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                          <div className="text-center px-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                            <p className="text-xs text-gray-600">
                              {generation.jobStatus?.message || 'Generating...'}
                            </p>
                          </div>
                        </div>
                        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-yellow-500 text-white">Processing</span>
                      </div>
                    ) : null}

                    <div className="p-3 space-y-2 pb-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-900 truncate">
                          Photo style: {generation.status === 'processing' || generation.status === 'pending' 
                            ? 'Processing...' 
                            : generation.generatedPhotos.length > 0 
                            ? generation.generatedPhotos[0].style 
                            : 'Freestyle'
                          }
                        </p>
                        <span className="text-xs text-gray-500">{formatDate(generation.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {generation.isOriginal && `${generation.creditsUsed} credits`}
                          {generation.remainingRegenerations > 0 && (
                            <span className="ml-2 text-green-600">
                              • {generation.remainingRegenerations} regenerations left
                            </span>
                          )}
                          {generation.remainingRegenerations === 0 && (
                            <span className={generation.isOriginal ? "ml-2 text-gray-400" : "text-gray-400"}>
                              {generation.isOriginal ? '• No regenerations left' : 'Regenerated photo'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 relative">
                          {generation.status === 'completed' ? (
                            <>
                              <button 
                                onClick={async () => {
                                  if (generation.generatedPhotos.length > 0) {
                                    try {
                                      const response = await fetch(generation.generatedPhotos[0].url)
                                      const blob = await response.blob()
                                      const url = window.URL.createObjectURL(blob)
                                      const link = document.createElement('a')
                                      link.href = url
                                      link.download = `generated-photo-${generation.id}.png`
                                      document.body.appendChild(link)
                                      link.click()
                                      document.body.removeChild(link)
                                      window.URL.revokeObjectURL(url)
                                    } catch (error) {
                                      console.error('Download failed:', error)
                                      alert('Download failed. Please try again.')
                                    }
                                  }
                                }}
                                className="relative group text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-blue-50 transition-colors"
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
                                  Download
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </button>
                              {generation.remainingRegenerations > 0 && (
                                <button 
                                  onClick={() => handleRegenerate(generation.id)}
                                  disabled={regenerating === generation.id}
                                  className="relative group text-sm text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-green-50 transition-colors"
                                >
                                  {regenerating === generation.id ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b border-green-600"></div>
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
                                    {regenerating === generation.id ? 'Regenerating...' : `Regenerate (${generation.remainingRegenerations} left)`}
                                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </button>
                              )}
                              <button 
                                onClick={() => handleDelete(generation.id)}
                                disabled={deleting === generation.id}
                                className="relative group text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 transition-colors"
                              >
                                {deleting === generation.id ? (
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
                                  {deleting === generation.id ? 'Deleting...' : 'Delete generation'}
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">Processing...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-center py-12">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No generations yet</h3>
                <p className="mt-1 text-sm text-gray-500">Upload a selfie and generate your first team photos.</p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push(`/invite-dashboard/${token}`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-hover"
                  >
                    Upload Selfie
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {selectedGeneration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Generated Photos</h3>
                <button
                  onClick={() => setSelectedGeneration(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedGeneration.generatedPhotos.map((photo, index) => (
                  <div key={photo.id} className="relative">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={photo.url}
                        alt={`Generated photo ${index + 1}`}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <button
                      onClick={() => handleDownload(photo.url, `team-photo-${selectedGeneration.id}-${index + 1}.jpg`)}
                      className="absolute top-2 right-2 p-2 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-100"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
