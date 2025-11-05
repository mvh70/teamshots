'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import { useAutosaveStyle } from '@/lib/ui/useAutosaveStyle'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyle, loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'

export interface StyleFormProps {
  mode: 'create' | 'edit'
  contextType: 'personal' | 'team' | 'freePackage'
  backUrl: string
  scope: 'individual' | 'pro' | 'freePackage'
  apiEndpoint?: string
  contextId?: string
  showButtons?: boolean
  autosaveName?: string
  hideFormCard?: boolean
  hideMessages?: boolean
}

export interface Context {
  id: string
  name: string
  settings?: PhotoStyleSettingsType
  backgroundUrl?: string
  backgroundPrompt?: string
  logoUrl?: string
  stylePreset: string
  customPrompt?: string
  createdAt: string
}

export default function StyleForm({
  mode,
  contextType,
  backUrl,
  scope,
  apiEndpoint,
  contextId,
  showButtons = true,
  autosaveName,
  hideFormCard = false,
  hideMessages = false
}: StyleFormProps) {
  const params = useParams()
  const router = useRouter()
  
  const [context, setContext] = useState<Context | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [styleContextId, setStyleContextId] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [setAsActive, setSetAsActive] = useState(false)
  
  const { status: styleStatus, contextId: autosaveContextId } = useAutosaveStyle({
    scope,
    packageId: scope === 'freePackage' ? 'freepackage' : 'headshot1',
    settings: photoStyleSettings,
    initialContextId: mode === 'edit' && styleContextId !== null ? styleContextId : undefined,
    name: autosaveName || name
  })

  // Load context data for edit mode
  useEffect(() => {
    if (mode === 'edit') {
      const fetchContext = async () => {
        try {
          // For freePackage scope, load by scope instead of by ID
          if (scope === 'freePackage') {
            const { ui, contextId: loadedId } = await loadStyle({ scope: 'freePackage' })
            setPhotoStyleSettings(ui)
            setStyleContextId(loadedId)
            // Ensure we're using freepackage defaults if no context found
            if (!loadedId || !ui || Object.keys(ui).length === 0) {
              const freepackagePkg = getPackageConfig('freepackage')
              setPhotoStyleSettings(freepackagePkg.defaultSettings)
            }
          } else if (params.id || contextId) {
            // For personal/team, load by ID
            const idToLoad = (params.id as string) || (contextId as string)
            const endpoint = apiEndpoint || `/api/styles/${idToLoad}`
            const data = await jsonFetcher<{ context?: Context } & Context>(endpoint)
            const contextData = data.context || data
            
            if (contextData) {
              setContext(contextData)
              setName(contextData.name || '')
              setCustomPrompt(contextData.customPrompt || '')
              // Load via unified style service
              const { ui, contextId: loadedId } = await loadStyleByContextId(idToLoad)
              setPhotoStyleSettings(ui)
              setStyleContextId(loadedId)
              // Determine if this context is currently the default (active)
              try {
                const listEndpoint = `/api/styles/${contextType === 'team' ? 'team' : 'personal'}`
                const listRes = await jsonFetcher<{ activeContext?: { id?: string } }>(listEndpoint)
                const activeId = listRes?.activeContext?.id
                if (activeId && activeId === idToLoad) {
                  setSetAsActive(true)
                }
              } catch {
                // Non-fatal if this check fails; checkbox remains manual
              }
            } else {
              setError('Failed to load context')
            }
          }
        } catch {
          setError('Failed to load context')
        } finally {
          setLoading(false)
        }
      }

      fetchContext()
    } else {
      setLoading(false)
    }
  }, [mode, params.id, apiEndpoint, scope, contextId, contextType])

  // Sync autosave context ID
  useEffect(() => {
    if (autosaveContextId && autosaveContextId !== styleContextId) {
      setStyleContextId(autosaveContextId)
    }
  }, [autosaveContextId, styleContextId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // In create mode, if autosave has already created a contextId, use it to update instead of creating new
      const existingContextId = mode === 'create' ? (styleContextId || autosaveContextId) : ((params.id as string) || (contextId as string))
      
      const endpoint = apiEndpoint || (mode === 'create' && !existingContextId ? '/api/styles' : existingContextId ? `/api/styles/${existingContextId}` : '/api/styles')
      const method = mode === 'create' && !existingContextId ? 'POST' : existingContextId ? 'PUT' : 'POST'
      
      const body: Record<string, unknown> = {
        settings: photoStyleSettings,
        customPrompt,
        setAsActive
      }

      if (mode === 'create') {
        body.name = name
        body.contextType = contextType
      } else {
        body.name = name
      }

      await jsonFetcher(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      setSuccess(`${mode === 'create' ? 'Style created' : 'Style updated'} successfully!`)
      setTimeout(() => {
        router.push(backUrl)
      }, 1500)
    } catch {
      setError(`Failed to ${mode === 'create' ? 'create' : 'update'} style`)
    } finally {
      setSaving(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  // Error state (only for edit mode when context fails to load)
  if (error && !context && mode === 'edit') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => router.push(backUrl)}
          className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
        >
          Back to {contextType === 'personal' ? 'Personal' : 'Team'} Photo Styles
        </button>
      </div>
    )
  }

  const formContent = (
    <div className="space-y-6">
      {/* Show name field only if we're not using autosave name */}
      {!autosaveName && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Style Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder={contextType === 'personal' ? 'My Personal Style' : 'Corporate Headshots'}
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Photo Style Settings
          </label>
          <span className={`text-xs font-medium ${
            styleStatus === 'error' ? 'text-red-600' : styleStatus === 'saved' ? 'text-green-600' : 'text-gray-500'
          }`}>
            {styleStatus === 'error' ? 'Not saved' : styleStatus === 'saving' ? 'Saving…' : styleStatus === 'saved' ? 'Saved' : 'Autosave on'}
          </span>
        </div>
        <PhotoStyleSettings
          value={photoStyleSettings}
          onChange={setPhotoStyleSettings}
          packageId={scope === 'freePackage' ? 'freepackage' : 'headshot1'}
        />
      </div>

      {/* Custom Prompt only for personal and team (not freePackage) */}
      {scope !== 'freePackage' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            placeholder={`Additional instructions for this ${contextType} style...`}
          />
        </div>
      )}

      {/* Set as Active checkbox only for personal and team (not freePackage) */}
      {scope !== 'freePackage' && (
        <div className="flex items-center">
          <input
            type="checkbox"
            id="setAsActive"
            checked={setAsActive}
            onChange={(e) => setSetAsActive(e.target.checked)}
            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
          />
          <label htmlFor="setAsActive" className="ml-2 text-sm text-gray-700">
            Set as default {contextType === 'personal' ? 'personal' : 'team'} style
          </label>
        </div>
      )}

      {/* Action buttons */}
      {showButtons && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving || (!autosaveName && !name.trim())}
            className="px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving 
              ? (mode === 'create' ? 'Creating...' : 'Saving...') 
              : (mode === 'create' ? 'Create Style' : 'Save Changes')}
          </button>
          <button
            onClick={() => router.push(backUrl)}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Success Message */}
      {!hideMessages && success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {!hideMessages && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      {hideFormCard ? (
        formContent
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {formContent}
        </div>
      )}
    </>
  )
}
