'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { jsonFetcher } from '@/lib/fetcher'

interface Context {
  id: string
  name: string
  settings?: {
    background?: {
      key?: string
      prompt?: string
      type?: string
      color?: string
    }
    branding?: {
      logoKey?: string
      type?: string
      position?: string
    }
    clothing?: {
      style?: string
      details?: string
      accessories?: string[]
      colors?: {
        topCover?: string
        topBase?: string
        bottom?: string
      }
    }
    expression?: {
      type?: string
    }
    lighting?: {
      type?: string
    }
  }
  // Legacy fields for backward compatibility
  backgroundUrl?: string
  backgroundPrompt?: string
  logoUrl?: string
  stylePreset: string
  customPrompt?: string
  createdAt: string
}

interface ContextsData {
  contexts: Context[]
  activeContext?: Context
  contextType?: 'personal' | 'company'
}

// Helper function to extract key from proxy URL
function extractKeyFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('key') || undefined
  } catch {
    return undefined
  }
}

function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export default function PersonalPhotoStylesPage() {
  const t = useTranslations('contexts')
  const [contextsData, setContextsData] = useState<ContextsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success] = useState<string | null>(null)

  const fetchContexts = useCallback(async () => {
    try {
      const data = await jsonFetcher<{ contexts?: Context[]; activeContext?: Context }>('/api/contexts/personal')
      setContextsData({
        contexts: data.contexts || [],
        activeContext: data.activeContext
      })
      setError(null)
    } catch {
      setError('Failed to fetch personal photo styles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContexts()
  }, [fetchContexts])


  const handleDeleteContext = async (contextId: string) => {
    if (!confirm(t('confirmations.deleteContext'))) return

    try {
      await jsonFetcher(`/api/contexts/${contextId}`, {
        method: 'DELETE'
      })
      await fetchContexts()
    } catch {
      setError(t('errors.deleteFailed'))
    }
  }

  const handleActivateContext = async (contextId: string) => {
    try {
      await jsonFetcher(`/api/contexts/${contextId}/activate`, {
        method: 'POST'
      })
      await fetchContexts()
    } catch {
      setError(t('errors.activateFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Personal Photo Styles
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              Personal Styles
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            {t('subtitleIndividual')}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/app/contexts/personal/create'}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover"
        >
          <PlusIcon className="h-5 w-5" />
          Create Personal Style
        </button>
      </div>


      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Contexts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contextsData?.contexts.map((context) => (
          <div
            key={context.id}
            className={`bg-white rounded-lg border-2 p-6 ${
              contextsData.activeContext?.id === context.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{context.name}</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Personal
                </span>
                {contextsData.activeContext?.id === context.id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.location.href = `/app/contexts/personal/${context.id}/edit`
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteContext(context.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              {/* Left Column - Photo Style Settings */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 mb-2">Photo Style</h4>
                {(() => {
                  const backgroundKey = context.settings?.background?.key || extractKeyFromUrl(context.backgroundUrl || '')
                  const backgroundPrompt = context.settings?.background?.prompt || context.backgroundPrompt
                  const backgroundType = context.settings?.background?.type
                  const backgroundColor = context.settings?.background?.color
                  
                  if (backgroundKey || backgroundPrompt || backgroundType) {
                    return (
                      <div className="flex items-center gap-2">
                        <strong>Background:</strong>
                        {backgroundKey ? (
                          <div className="flex items-center gap-2">
                            <Image 
                              src={getThumbnailUrl(backgroundKey)}
                              alt="Background thumbnail"
                              width={24}
                              height={24}
                              className="w-6 h-6 rounded object-cover border border-gray-200"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                            <span>Custom</span>
                          </div>
                        ) : backgroundPrompt ? (
                          <span>AI Generated: {backgroundPrompt}</span>
                        ) : backgroundType === 'gradient' ? (
                          <div className="flex items-center gap-2">
                            {backgroundColor && backgroundColor.startsWith('#') ? (
                              <div 
                                className="w-4 h-4 rounded border border-gray-300"
                                style={{
                                  background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}40)`
                                }}
                              />
                            ) : null}
                            <span>Gradient {backgroundColor ? `(${backgroundColor})` : ''}</span>
                          </div>
                        ) : backgroundType === 'neutral' ? (
                          <div className="flex items-center gap-2">
                            {backgroundColor && backgroundColor.startsWith('#') ? (
                              <div 
                                className="w-4 h-4 rounded border border-gray-300"
                                style={{ backgroundColor: backgroundColor }}
                              />
                            ) : null}
                            <span>Solid {backgroundColor || '#ffffff'}</span>
                          </div>
                        ) : (
                          <span className="capitalize">{backgroundType || 'Office'} style</span>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}
                {(() => {
                  const logoKey = context.settings?.branding?.logoKey || extractKeyFromUrl(context.logoUrl || '')
                  const brandingType = context.settings?.branding?.type
                  const logoPosition = context.settings?.branding?.position
                  if (logoKey || brandingType) {
                    return (
                      <div className="flex items-center gap-2">
                        <strong>Logo:</strong>
                        {logoKey ? (
                          <div className="flex flex-col gap-1">
                            <div className="w-12 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1">
                              <Image 
                                src={getThumbnailUrl(logoKey)}
                                alt="Logo thumbnail"
                                width={40}
                                height={24}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
                            </div>
                            {logoPosition && (
                              <span className="text-xs text-gray-500">
                                Position: {logoPosition}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="capitalize">{brandingType === 'include' ? 'Included' : 'Excluded'}</span>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}
                <div className="flex items-center gap-2">
                  <strong>Style:</strong>
                  <span className="capitalize">{context.stylePreset}</span>
                </div>
              </div>

              {/* Right Column - User Style Settings */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 mb-2">User Style</h4>
                {(() => {
                  const clothingStyle = context.settings?.clothing?.style
                  const clothingDetails = context.settings?.clothing?.details
                  const clothingAccessories = context.settings?.clothing?.accessories
                  const clothingColors = context.settings?.clothing?.colors
                  
                  if (clothingStyle && clothingStyle !== 'user-choice') {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong>Clothing:</strong>
                          <span className="capitalize">{clothingStyle}</span>
                        </div>
                        {clothingDetails && (
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-xs text-gray-500">Style:</span>
                            <span className="text-xs capitalize">{clothingDetails}</span>
                          </div>
                        )}
                        {clothingAccessories && clothingAccessories.length > 0 && (
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-xs text-gray-500">Accessories:</span>
                            <span className="text-xs">{clothingAccessories.join(', ')}</span>
                          </div>
                        )}
                        {clothingColors && (clothingColors.topCover || clothingColors.topBase || clothingColors.bottom) && (
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-xs text-gray-500">Colors:</span>
                            <div className="flex items-center gap-1">
                              {clothingColors.topCover && (
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="w-3 h-3 rounded border border-gray-300"
                                    style={{ backgroundColor: clothingColors.topCover }}
                                  />
                                  <span className="text-xs">Cover</span>
                                </div>
                              )}
                              {clothingColors.topBase && (
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="w-3 h-3 rounded border border-gray-300"
                                    style={{ backgroundColor: clothingColors.topBase }}
                                  />
                                  <span className="text-xs">Base</span>
                                </div>
                              )}
                              {clothingColors.bottom && (
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="w-3 h-3 rounded border border-gray-300"
                                    style={{ backgroundColor: clothingColors.bottom }}
                                  />
                                  <span className="text-xs">Bottom</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}
                {(() => {
                  const expressionType = context.settings?.expression?.type
                  if (expressionType) {
                    return (
                      <div className="flex items-center gap-2">
                        <strong>Expression:</strong>
                        <span className="capitalize">{expressionType}</span>
                      </div>
                    )
                  }
                  return null
                })()}
                {(() => {
                  const lightingType = context.settings?.lighting?.type
                  if (lightingType) {
                    return (
                      <div className="flex items-center gap-2">
                        <strong>Lighting:</strong>
                        <span className="capitalize">{lightingType}</span>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            </div>


            <div className="mt-4 flex gap-2">
              {contextsData.activeContext?.id !== context.id && (
                <button
                  onClick={() => handleActivateContext(context.id)}
                  className="flex-1 px-3 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm"
                >
                  Set as Active
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
