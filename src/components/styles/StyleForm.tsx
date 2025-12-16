'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import PackageSelector from '@/components/packages/PackageSelector'
import { useAutosaveStyle } from '@/lib/ui/useAutosaveStyle'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyle, loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'
import { PrimaryButton, SecondaryButton } from '@/components/ui'
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('customization.photoStyle.autosave')
  
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
  const [pendingSetActive, setPendingSetActive] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState(scope === 'freePackage' ? 'freepackage' : 'headshot1')

  const autosaveInitialContextId = mode === 'edit'
    ? (loading ? null : (styleContextId ?? undefined))
    : undefined

  const pkg = getPackageConfig(selectedPackageId)

  const { status: styleStatus, contextId: autosaveContextId } = useAutosaveStyle({
    scope,
    packageId: selectedPackageId,
    settings: photoStyleSettings,
    initialContextId: autosaveInitialContextId,
    name: autosaveName || name
  })

  // Calculate progress - count editable sections (user-choice)
  const calculateProgress = () => {
    // Use the package's visible categories instead of hardcoded list
    const allCategories = pkg.visibleCategories
    
    let editableCount = 0
    let totalCount = 0
    
    allCategories.forEach(category => {
      const setting = photoStyleSettings[category as keyof PhotoStyleSettingsType]
      if (!setting) return
      
      totalCount++
      
      // Check if it's editable (user-choice)
      if (category === 'clothing') {
        if ((setting as { style?: string }).style === 'user-choice') {
          editableCount++
        }
      } else {
        if ((setting as { type?: string }).type === 'user-choice') {
          editableCount++
        }
      }
    })
    
    return { editableCount, totalCount }
  }

  const progress = calculateProgress()

  // Load context data for edit mode
  useEffect(() => {
    if (mode === 'edit') {
      const fetchContext = async () => {
        try {
          // For freePackage scope, load by scope instead of by ID
          if (scope === 'freePackage') {
            const { ui, contextId: loadedId, pkg } = await loadStyle({ scope: 'freePackage' })
            setPhotoStyleSettings(ui)
            setStyleContextId(loadedId)
            setSelectedPackageId(pkg.id)
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
              setCustomPrompt(contextData.settings?.customPrompt || '')
              // Load via unified style service
              const { ui, contextId: loadedId, pkg } = await loadStyleByContextId(idToLoad)
              console.log('[StyleForm] Loaded style:', { packageId: pkg.id, contextId: loadedId, customClothing: ui.customClothing })
              setPhotoStyleSettings(ui)
              setStyleContextId(loadedId)
              setSelectedPackageId(pkg.id)
              console.log('[StyleForm] Set selectedPackageId to:', pkg.id)
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

  // Sync autosave context ID from hook result.
  // This is intentional: the autosave hook creates a new contextId on first save,
  // and we need to track it locally to use in the save handler.
  useEffect(() => {
    if (autosaveContextId && autosaveContextId !== styleContextId) {
      setStyleContextId(autosaveContextId)
    }
  }, [autosaveContextId, styleContextId])

  const activateStyle = async (targetId: string) => {
    try {
      await jsonFetcher(`/api/styles/${targetId}/activate`, { method: 'POST' })
      setPendingSetActive(false)
    } catch {
      setPendingSetActive(false)
      setSetAsActive(false)
      setError('Failed to set style as default')
    }
  }

  const deactivateStyle = async (targetId: string) => {
    try {
      await jsonFetcher(`/api/styles/${targetId}/activate`, { method: 'DELETE' })
      setPendingSetActive(false)
    } catch {
      setPendingSetActive(false)
      setSetAsActive(true)
      setError('Failed to unset style as default')
    }
  }

  const handleSetAsActiveChange = (checked: boolean) => {
    setSetAsActive(checked)
    if (!checked) {
      setPendingSetActive(false)
      const targetId = styleContextId || autosaveContextId
      if (targetId) {
        void deactivateStyle(targetId)
      }
      return
    }

    const targetId = styleContextId || autosaveContextId
    if (targetId) {
      void activateStyle(targetId)
    } else {
      setPendingSetActive(true)
    }
  }

  // Activate style when set-as-active is triggered and we have a valid ID.
  // This is an intentional event-driven pattern: user clicks "set as active",
  // we wait for autosave to complete, then activate the style.
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    if (!setAsActive || !pendingSetActive) return
    const targetId = styleContextId || autosaveContextId
    if (targetId) {
      void activateStyle(targetId)
    }
  }, [setAsActive, pendingSetActive, styleContextId, autosaveContextId])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

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
    <div className="space-y-8">
      {/* Show name field only if we're not using autosave name and not freePackage (singleton) */}
      {!autosaveName && scope !== 'freePackage' && (
        <div id="style-name-input-section">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Style Name *
          </label>
          <input
            id="style-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400"
            placeholder={contextType === 'personal' ? 'My Personal Style' : 'Corporate Headshots'}
          />
        </div>
      )}

      {/* Package Selector - only for non-freePackage scopes */}
      {scope !== 'freePackage' && (
        <PackageSelector
          value={selectedPackageId}
          onChange={(packageId) => {
            setSelectedPackageId(packageId)
            const pkg = getPackageConfig(packageId)
            setPhotoStyleSettings(pkg.defaultSettings)
          }}
        />
      )}

      <div>
        <label className="block text-lg font-semibold text-gray-900 mb-6">
          Photo Style Settings
        </label>
        <PhotoStyleSettings
          value={photoStyleSettings}
          onChange={setPhotoStyleSettings}
          packageId={selectedPackageId}
          showToggles={true}
        />
      </div>

      {/* Custom Prompt only for personal and team (not freePackage) */}
      {scope !== 'freePackage' && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Custom Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 resize-y"
            placeholder={`Additional instructions for this ${contextType} style...`}
          />
        </div>
      )}

      {/* Set as Active checkbox only for personal and team (not freePackage) */}
      {scope !== 'freePackage' && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
          <input
            type="checkbox"
            id="setAsActive"
            checked={setAsActive}
            onChange={(e) => handleSetAsActiveChange(e.target.checked)}
            className="h-5 w-5 text-brand-primary focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 border-gray-300 rounded transition-all duration-200 cursor-pointer"
          />
          <label htmlFor="setAsActive" className="text-sm font-medium text-gray-900 cursor-pointer">
            Set as default {contextType === 'personal' ? 'personal' : 'team'} style
          </label>
        </div>
      )}

      {/* Action buttons */}
      {showButtons && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <PrimaryButton
            onClick={handleSave}
            disabled={saving || (!autosaveName && !name.trim())}
            loading={saving}
            loadingText={mode === 'create' ? 'Creating...' : 'Saving...'}
          >
            {mode === 'create' ? 'Create Style' : 'Save Changes'}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => router.push(backUrl)}
          >
            Cancel
          </SecondaryButton>
        </div>
      )}
    </div>
  )

  // Floating autosave badge component
  const AutosaveBadge = ({ status }: { status: typeof styleStatus }) => {
    const [showBadge, setShowBadge] = useState(false)

    // Control badge visibility based on status with auto-hide timer for "saved" state.
    // This is intentional: we show the badge during saving/error, and auto-hide after 3s when saved.
    /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
    useEffect(() => {
      if (status === 'saved') {
        setShowBadge(true)
        const timer = setTimeout(() => {
          setShowBadge(false)
        }, 3000)
        return () => clearTimeout(timer)
      } else if (status === 'saving' || status === 'error') {
        // Always show badge when saving or error
        setShowBadge(true)
      } else {
        // Hide badge for "idle" status
        setShowBadge(false)
      }
    }, [status])
    /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

    const getStatusConfig = () => {
      switch (status) {
        case 'saving':
          return {
            icon: <ArrowPathIcon className="h-4 w-4 animate-spin" />,
            text: t('saving', { default: 'Saving...' }),
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            textColor: 'text-blue-700'
          }
        case 'saved':
          return {
            icon: <CheckCircleIcon className="h-4 w-4" />,
            text: t('saved', { default: 'All changes saved' }),
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            textColor: 'text-green-700'
          }
        case 'error':
          return {
            icon: <ExclamationCircleIcon className="h-4 w-4" />,
            text: t('error', { default: 'Save failed' }),
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            textColor: 'text-red-700'
          }
        default:
          return {
            icon: <CheckCircleIcon className="h-4 w-4" />,
            text: t('idle', { default: 'Autosave on' }),
            bgColor: 'bg-gray-50',
            borderColor: 'border-gray-200',
            textColor: 'text-gray-600'
          }
      }
    }

    const config = getStatusConfig()
    const tProgress = useTranslations('customization.photoStyle.progress')

    return (
      <div className="fixed top-20 right-4 md:right-6 z-20 flex flex-col gap-3 animate-fade-in max-w-[280px] md:max-w-none">
        {/* Autosave status badge - conditionally rendered */}
        {showBadge && (
          <div 
            className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 transition-all duration-300 backdrop-blur-sm ${
              status === 'saved' ? 'animate-scale-in' : ''
            }`}
          >
            <span className={config.textColor}>{config.icon}</span>
            <span className={`text-sm font-semibold ${config.textColor}`}>
              {config.text}
            </span>
            {status === 'error' && (
              <button
                onClick={() => setPhotoStyleSettings({ ...photoStyleSettings })}
                className="ml-auto text-xs font-medium underline hover:no-underline transition-all"
              >
                {t('retry', { default: 'Retry' })}
              </button>
            )}
          </div>
        )}
        
        {/* Progress counter */}
        {progress.totalCount > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 mb-2 leading-tight">
                {scope === 'pro' 
                  ? tProgress('editableTeam', { 
                      count: progress.editableCount, 
                      total: progress.totalCount,
                      default: `${progress.editableCount} of ${progress.totalCount} editable by team members`
                    })
                  : tProgress('editable', { 
                      count: progress.editableCount, 
                      total: progress.totalCount,
                      default: `${progress.editableCount} of ${progress.totalCount} editable`
                    })
                }
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${(progress.editableCount / progress.totalCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Floating Autosave Badge */}
      <AutosaveBadge status={styleStatus} />

      {/* Success Message */}
      {!hideMessages && success && (
        <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-lg p-4">
          <p className="text-brand-secondary">{success}</p>
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
          {formContent}
        </div>
      )}
    </>
  )
}
