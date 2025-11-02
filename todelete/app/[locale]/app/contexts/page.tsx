'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'

interface Context {
  id: string
  name: string
  settings?: PhotoStyleSettingsType
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
  contextType?: 'personal' | 'team'
}



// Helper function to extract key from proxy URL
function extractKeyFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname === '/api/files/get') {
      return urlObj.searchParams.get('key') || undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

// Helper function to get thumbnail URL from S3 key
function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export default function ContextsPage() {
  const t = useTranslations('contexts')
  const [contextsData, setContextsData] = useState<ContextsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingContext, setEditingContext] = useState<Context | null>(null)
  const [isTeamAdmin, setIsTeamAdmin] = useState(false)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [customPromptLocal, setCustomPromptLocal] = useState<string>('')


  const fetchContexts = useCallback(async () => {
    try {
      const data = await jsonFetcher<ContextsData>('/api/contexts')
      setContextsData(data)
    } catch {
      setError(t('errors.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])



  useEffect(() => {
    fetchContexts()
    fetchUserRole()
  }, [fetchContexts])

  // Update photo style settings when editing a context
  useEffect(() => {
    if (editingContext) {
      // Convert legacy context data to new photo style settings format
      const settings: PhotoStyleSettingsType = {
        background: {
          ...editingContext.settings?.background,
          // If settings exist but key is missing, try to get it from legacy URL
          key: editingContext.settings?.background?.key || 
               (editingContext.backgroundUrl ? extractKeyFromUrl(editingContext.backgroundUrl) : undefined),
          // If settings exist but type is missing, determine from legacy URL
          type: editingContext.settings?.background?.type || 
                (editingContext.backgroundUrl ? 'custom' : 'office'),
          // If settings exist but prompt is missing, get from legacy field
          prompt: editingContext.settings?.background?.prompt || editingContext.backgroundPrompt
        },
        branding: {
          ...editingContext.settings?.branding,
          // If settings exist but logoKey is missing, try to get it from legacy URL
          logoKey: editingContext.settings?.branding?.logoKey || 
                   (editingContext.logoUrl ? extractKeyFromUrl(editingContext.logoUrl) : undefined),
          // If settings exist but type is missing, determine from legacy URL
          type: editingContext.settings?.branding?.type || 
                (editingContext.logoUrl ? 'include' : 'exclude')
        },
        style: editingContext.settings?.style || {
          type: 'preset',
          preset: editingContext.stylePreset as 'corporate' | 'casual' | 'creative' | 'modern' | 'classic' | 'artistic'
        },
        // Set other categories to user-choice by default for existing contexts
        clothing: editingContext.settings?.clothing || { style: 'user-choice' },
        expression: editingContext.settings?.expression || { type: 'user-choice' },
        lighting: editingContext.settings?.lighting || { type: 'user-choice' }
      }
      setPhotoStyleSettings(settings)
      setCustomPromptLocal(editingContext.customPrompt || '')
    } else {
      setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
      setCustomPromptLocal('')
    }
  }, [editingContext])

  const fetchUserRole = async () => {
    try {
      const data = await jsonFetcher<{ userRole: { isTeamAdmin: boolean } }>('/api/dashboard/stats')
      setIsTeamAdmin(data.userRole.isTeamAdmin)
    } catch (err) {
      console.error('Failed to fetch user role:', err)
    }
  }

  const handleCreateContext = async (formData: FormData) => {
    setLoading(true)
    setError('')

    try {
      // Use the current photo style settings (file uploads are already handled in the components)
      const updatedSettings = { ...photoStyleSettings }

      // Create context with new settings structure
      const requestBody = {
        name: formData.get('name'),
        settings: updatedSettings,
        customPrompt: formData.get('customPrompt'),
        setAsActive: formData.get('setAsActive') === 'on'
      }

      await jsonFetcher('/api/contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      await fetchContexts()
      setShowCreateForm(false)
      setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
    } catch {
      setError(t('errors.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateContext = async (formData: FormData) => {
    if (!editingContext) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Use the current photo style settings (file uploads are already handled in the components)
      const updatedSettings = { ...photoStyleSettings }

      // Update context with new settings structure
      await jsonFetcher(`/api/contexts/${editingContext.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          settings: updatedSettings,
          customPrompt: formData.get('customPrompt'),
          setAsActive: formData.get('setAsActive') === 'on'
        })
      })

      await fetchContexts()
      setEditingContext(null)
      setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
      setError(null)
      setSuccess(null)
    } catch {
      setError(t('errors.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

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

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-green-800">{success}</p>
          <button
            onClick={() => {
              setSuccess(null)
              setEditingContext(null)
              setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
            }}
            className="text-green-600 hover:text-green-800 font-medium"
          >
            {t('actions.close')}
          </button>
        </div>
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
              {t('title')}
            </h1>
            {contextsData?.contextType && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                contextsData.contextType === 'team' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {contextsData.contextType === 'team' ? 'Team Contexts' : 'Personal Contexts'}
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {isTeamAdmin ? t('subtitle') : t('subtitleIndividual')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover"
          >
            <PlusIcon className="h-5 w-5" />
            {t('createContext')}
          </button>
        </div>
      </div>

      {/* Warning when no active context - only for team mode */}
      {isTeamAdmin && !contextsData?.activeContext && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-yellow-800 font-medium">
              {t('status.noActiveContext')}
            </span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            {t('status.mustSetActive')}
          </p>
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
                {contextsData.contextType && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    contextsData.contextType === 'team' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {contextsData.contextType === 'team' ? 'Team' : 'Personal'}
                  </span>
                )}
                {contextsData.activeContext?.id === context.id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {t('status.active')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingContext(context)}
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

            {contextsData.activeContext?.id !== context.id && (
              <button
                onClick={() => handleActivateContext(context.id)}
                className="w-full mt-4 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {contextsData?.contextType === 'team' ? t('buttons.setAsActive') : t('buttons.setAsDefault')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Form - Inline */}
      {(showCreateForm || editingContext) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingContext ? 'Edit Photo Style Settings' : 'Create Photo Style Settings'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Background, branding, and overall photo style
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setEditingContext(null)
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  if (editingContext) {
                    handleUpdateContext(formData)
                  } else {
                    handleCreateContext(formData)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.name')} *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingContext?.name || ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-900"
                    placeholder={t('form.namePlaceholder')}
                  />
                </div>

                {/* Photo Style Settings */}
                <PhotoStyleSettings
                  value={photoStyleSettings}
                  onChange={setPhotoStyleSettings}
                />

                {/* Additional Context Settings - Only Custom Prompt remains */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('form.customPrompt')}
                  </label>
                  <textarea
                    name="customPrompt"
                    value={customPromptLocal}
                    onChange={(e) => setCustomPromptLocal(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-900"
                    placeholder={t('form.customPromptPlaceholder')}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="setAsActive"
                    id="setAsActive"
                    defaultChecked={
                      editingContext 
                        ? editingContext.id === contextsData?.activeContext?.id
                        : !contextsData?.activeContext
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <label htmlFor="setAsActive" className="ml-2 text-sm text-gray-700">
                    {contextsData?.contextType === 'team' ? t('form.setAsActive') : t('form.setAsDefault')}
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('form.uploading', { default: 'Uploading...' })}
                      </span>
                    ) : (
                      editingContext ? t('form.update') : t('form.create')
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setEditingContext(null)
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {t('form.cancel')}
                  </button>
                </div>
              </form>
        </div>
      )}
    </div>
  )
}
