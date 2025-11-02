'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import PhotoStyleSettings from '@/components/customization/PhotoStyleSettings'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import PackageSelector from '@/components/packages/PackageSelector'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyle, loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })
const GenerationTypeSelector = dynamic(() => import('@/components/GenerationTypeSelector'), { ssr: false })

export default function StartGenerationPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const t = useTranslations('app.sidebar.generate')
  const keyFromQuery = useMemo(() => searchParams.get('key') || '', [searchParams])
  const typeFromQuery = useMemo(() => searchParams.get('type') as 'personal' | 'team' | null, [searchParams])
  const [key, setKey] = useState<string>('')
  const [selfieId, setSelfieId] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(Boolean(keyFromQuery))
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  const { credits: userCredits, loading: creditsLoading } = useCredits()
  const [activeContext, setActiveContext] = useState<{
    id: string
    name: string
    settings?: {
      background?: { type?: string; prompt?: string }
      branding?: { type?: string }
      style?: { preset?: string }
      clothing?: { type?: string }
      expression?: { type?: string }
      lighting?: { type?: string }
    }
    backgroundPrompt?: string
    stylePreset?: string
    customPrompt?: string
  } | null>(null)
  const [availableContexts, setAvailableContexts] = useState<Array<{
    id: string
    name: string
    settings?: Record<string, unknown>
  }>>([])
  const [contextLoaded, setContextLoaded] = useState(false)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [isFreePlan, setIsFreePlan] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')

  useEffect(() => {
    // Keep local state in sync if query changes
    if (keyFromQuery && !key) {
      setKey(keyFromQuery)
      setIsApproved(true) // If key comes from query, it's already approved
      
      // Find existing selfie by key
      findSelfieByKey(keyFromQuery)
    }
  }, [keyFromQuery, key])

  const findSelfieByKey = async (key: string) => {
    try {
      const { id } = await jsonFetcher<{ id: string }>(`/api/uploads/find-by-key?key=${encodeURIComponent(key)}`, {
        credentials: 'include' // Required for Safari to send cookies
      })
      setSelfieId(id)
    } catch (error) {
      console.error('Error finding selfie by key:', error)
    }
  }

  // Fetch user credits and active context
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return
      
      try {
        // Credits are now managed by CreditsContext
        setContextLoaded(true)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        // Credits are handled by CreditsContext
        setContextLoaded(true)
      }
    }

    fetchData()
  }, [session?.user?.id])

  // Check if user is on free plan (based on planPeriod)
  useEffect(() => {
    const checkFreePlan = async () => {
      if (!session?.user?.id) return
      
      try {
        const subRes = await jsonFetcher<{ subscription: { period?: 'free' | 'try_once' | 'monthly' | 'annual' | null } | null }>('/api/user/subscription')
        const period = subRes?.subscription?.period ?? null
        const free = period === 'free'
        setIsFreePlan(free)
      } catch (err) {
        console.error('Failed to check subscription:', err)
        setIsFreePlan(false)
      }
    }

    checkFreePlan()
  }, [session?.user?.id])

  // Fetch contexts when generation type is determined
  useEffect(() => {
    const fetchContexts = async () => {
      if (!session?.user?.id || !generationType) return
      
      try {
          // If free plan, always use the Free Package style
        if (isFreePlan) {
          const { contextId, ui } = await loadStyle({ scope: 'freePackage' })
          
          if (contextId && ui) {
            // Use the deserialized UI settings from the loadStyle service
            const freeContext = {
              id: contextId,
              name: 'Free Package Style',
              settings: ui
            }
            setActiveContext(freeContext)
            setPhotoStyleSettings(ui)
            setOriginalContextSettings(ui) // Store original context settings
            setAvailableContexts([]) // Free plan users don't have custom contexts
            // Set freepackage as selected for free plan users
            setSelectedPackageId('freepackage')
          } else {
            console.error('Free Package style not found')
            setActiveContext(null)
            setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
            setOriginalContextSettings(undefined)
          }
          return
        }

        // For paid users, fetch contexts based on generation type
        const endpoint = generationType === 'personal' ? '/api/styles/personal' : '/api/styles/team'
        const contextData = await jsonFetcher<{ contexts?: unknown[]; activeContext?: unknown }>(endpoint)
        const contexts = (contextData.contexts || []) as Array<{ id: string; name: string; settings?: Record<string, unknown> }>
        setAvailableContexts(contexts)
          
          // Set active context if available
          let activeContext = null
          if (contextData.activeContext) {
            activeContext = contextData.activeContext as { id: string; name: string; settings?: Record<string, unknown> }
            setActiveContext(activeContext)
          } else {
            // Default to freestyle if no context is active
            setActiveContext(null)
          }
          
          // Load deserialized settings for active context if available
          if (activeContext) {
            // loadStyleByContextId extracts packageId from the context settings in the database
            const { ui, pkg } = await loadStyleByContextId(activeContext.id)
            setPhotoStyleSettings(ui)
            setOriginalContextSettings(ui) // Store original context settings
            
            // Use the packageId from the loaded package (already extracted from database context)
            // This will be 'freepackage', 'headshot1', or any other package the team admin set
            const contextPackageId = pkg.id
            setSelectedPackageId(contextPackageId)
          } else {
            // No active context - initialize with default settings for individual users
            setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
            setOriginalContextSettings(undefined)
            // Set default package if not already set (PackageSelector will set it, but this is a fallback)
            if (!selectedPackageId) {
              setSelectedPackageId(PRICING_CONFIG.defaultSignupPackage)
            }
          }
      } catch (err) {
        console.error('Failed to fetch contexts:', err)
      }
    }

    fetchContexts()
  }, [session?.user?.id, generationType, isFreePlan, selectedPackageId])

  const onSelfieApproved = async (selfieKey: string, selfieId?: string) => {
    setKey(selfieKey)
    setIsApproved(true)
    
    // Set selfie ID if provided
    if (selfieId) {
      setSelfieId(selfieId)
    } else {
      // Fallback to finding selfie by key if ID not provided
      await findSelfieByKey(selfieKey)
    }
  }

  const onSelfieUploadCancel = () => {
    // User cancelled upload - go back to no key state
    setKey('')
    setIsApproved(false)
    setSelfieId(null)
  }

  const onTypeSelected = (type: 'personal' | 'team') => {
    setGenerationType(type)
  }

  const onProceed = async () => {
    if (!selfieId || !generationType) {
      console.error('Missing required data for generation')
      return
    }

    try {
      // Ensure packageId is set (default to headshot1 if not selected)
      const packageId = selectedPackageId || PRICING_CONFIG.defaultSignupPackage
      
      // Create generation request
      await jsonFetcher<{ success?: boolean; error?: string }>('/api/generations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfieId: selfieId,
          contextId: activeContext?.id,
          styleSettings: { ...photoStyleSettings, packageId },
          prompt: activeContext?.customPrompt || 'Professional headshot',
          generationType,
          creditSource: generationType === 'team' ? 'team' : 'individual',
        }),
      })

      // Redirect to appropriate generations page based on generation type
      const redirectPath = generationType === 'team' ? '/app/generations/team' : '/app/generations/personal'
      window.location.href = redirectPath
      
    } catch (error) {
      console.error('Failed to start generation:', error)
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Determine user access and whether to show generation type selector
  const hasTeamAccess = Boolean(session?.user?.person?.teamId)
  const hasIndividualAccess = userCredits.individual > 0
  const teamName = session?.user?.person?.team?.name
  
  // Check if user has enough credits for generation
  const hasEnoughCredits = (generationType === 'team' && userCredits.team >= PRICING_CONFIG.credits.perGeneration) || 
                          (generationType === 'personal' && userCredits.individual >= PRICING_CONFIG.credits.perGeneration)
  
  // Check if user has any credits at all
  const hasAnyCredits = userCredits.team > 0 || userCredits.individual > 0
  
  // Check if we have all required data
  const canGenerate = hasEnoughCredits && selfieId && generationType
  
  // Only show generation type selector if user has both options available
  const shouldShowGenerationTypeSelector = hasTeamAccess && hasIndividualAccess

  // Auto-select generation type if user only has one option
  useEffect(() => {
    if (!creditsLoading && contextLoaded && isApproved && !generationType) {
      // If type is specified in URL, use it (if user has access)
      if (typeFromQuery) {
        if (typeFromQuery === 'team' && hasTeamAccess) {
          setGenerationType('team')
          return
        } else if (typeFromQuery === 'personal' && hasIndividualAccess) {
          setGenerationType('personal')
          return
        }
      }
      
      if (shouldShowGenerationTypeSelector) {
        // User has both options, keep generationType as null to show selector
        return
      } else if (hasTeamAccess) {
        // User only has team access
        setGenerationType('team')
      } else if (hasIndividualAccess) {
        // User only has individual access
        setGenerationType('personal')
      }
    }
  }, [creditsLoading, contextLoaded, isApproved, shouldShowGenerationTypeSelector, hasTeamAccess, hasIndividualAccess, generationType, typeFromQuery])

  // Show upsell window if no credits available
  if (!creditsLoading && !hasAnyCredits) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('noCreditsTitle')}</h1>
            <p className="text-gray-600 mb-6">{t('noCreditsMessage')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/app/pricing"
                className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                }}
              >
                {t('buyCredits')}
              </Link>
              <Link
                href="/app/dashboard"
                className="px-6 py-3 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('backToDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!key ? (
        <SelfieUploadFlow
          onSelfieApproved={onSelfieApproved}
          onCancel={onSelfieUploadCancel}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            alert(error)
          }}
        />
      ) : creditsLoading || !contextLoaded ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      ) : !activeContext && hasTeamAccess ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Active Context</h2>
            <p className="text-gray-600 mb-4">Team users need to set up a photo style context before generating photos.</p>
            <Link 
              href="/app/contexts" 
              className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover"
            >
              Go to Contexts
            </Link>
          </div>
        </div>
      ) : shouldShowGenerationTypeSelector && !generationType ? (
        <GenerationTypeSelector
          uploadedPhotoKey={key}
          onTypeSelected={onTypeSelected}
          userCredits={userCredits}
          hasTeamAccess={hasTeamAccess}
          teamName={teamName}
        />
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              {/* Selfie Thumbnail */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                  <Image
                    src={`/api/files/get?key=${encodeURIComponent(key)}`}
                    alt="Selected selfie"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">{t('yourSelfie')}</p>
              </div>
              
              {/* Generation Details */}
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{t('readyToGenerate')}</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Generation type: <span className="font-medium text-gray-800">{generationType}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{PRICING_CONFIG.credits.perGeneration} credits</div>
                  <div className="text-sm text-gray-500">Cost per generation</div>
                {!hasEnoughCredits && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center mb-2">
                      <svg className="h-4 w-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-red-800">{t('insufficientCredits')}</span>
                    </div>
                    <p className="text-xs text-red-700 mb-2">
                      {t('insufficientCreditsMessage', { 
                        required: PRICING_CONFIG.credits.perGeneration,
                        current: generationType === 'team' ? userCredits.team : userCredits.individual 
                      })}
                    </p>
                    <Link
                      href="/app/pricing"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors"
                      style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                      }}
                    >
                      <PlusIcon className="h-3 w-3 mr-1" />
                      {t('buyMoreCredits')}
                    </Link>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Context Selection for Personal and Team Generations - Hide for free plan users */}
          {!isFreePlan && (generationType === 'personal' || generationType === 'team') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {generationType === 'personal' ? t('selectPhotoStyle') : 'Select Team Photo Style'}
              </h2>
              
              <div className="space-y-3">
                <div>
                  <select
                    value={activeContext?.id || 'freestyle'}
                    onChange={(e) => {
                      if (e.target.value === 'freestyle') {
                        setActiveContext(null)
                        setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
                      } else {
                        const selectedContext = availableContexts.find(ctx => ctx.id === e.target.value)
                        if (selectedContext) {
                          setActiveContext(selectedContext)
                          setPhotoStyleSettings(selectedContext.settings || DEFAULT_PHOTO_STYLE_SETTINGS)
                          setOriginalContextSettings(selectedContext.settings)
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                  >
                    <option value="freestyle">{t('freestyle')}</option>
                    {availableContexts.map((context) => (
                      <option key={context.id} value={context.id}>
                        {context.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-2">
                    {activeContext ? 
                      (generationType === 'personal' ? t('predefinedStyle') : 'Predefined team style settings are applied. You can customize user-choice settings for this generation.') : 
                      (availableContexts.length > 0 ? 
                        (generationType === 'personal' ? t('freestyleDescription') : 'Create a custom team photo style for this generation.') : 
                        (generationType === 'personal' ? t('freestyleOnlyDescription') : 'No team styles available. Create a custom team photo style for this generation.'))
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Free plan banner + Free package info */}
          {(isFreePlan || selectedPackageId === 'freepackage') && (
            <>
              <FreePlanBanner variant="personal" className="mb-4" />
            </>
          )}

          {/* Package Selector - Hide for free package contexts (set by team admin) */}
          {selectedPackageId !== 'freepackage' && (
            <PackageSelector
              value={selectedPackageId}
              onChange={(packageId) => {
                setSelectedPackageId(packageId)
                // Reload style settings for the selected package
                const pkg = getPackageConfig(packageId)
                setPhotoStyleSettings(pkg.defaultSettings)
              }}
            />
          )}

          {/* Photo Style Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Photo Style Settings</h2>
            <p className="text-sm text-gray-600 mb-6">
              {isFreePlan || selectedPackageId === 'freepackage' ? (
                <>Free Package style settings are applied. These settings are fixed for this context.</>
              ) : activeContext ? (
                <>Predefined settings from your context are shown below. You can customize user-choice settings for this generation.</>
              ) : generationType === 'personal' ? (
                <>Customize your photo style settings for this generation. All options are available since you chose freestyle.</>
              ) : (
                <>Customize your photo style settings for this generation.</>
              )}
            </p>
            
            <PhotoStyleSettings
              value={photoStyleSettings}
              onChange={setPhotoStyleSettings}
              readonlyPredefined={!!activeContext || isFreePlan || selectedPackageId === 'freepackage'}
              originalContextSettings={originalContextSettings}
              showToggles={!!activeContext && !isFreePlan && selectedPackageId !== 'freepackage'}
              packageId={selectedPackageId || PRICING_CONFIG.defaultSignupPackage}
            />

            {/* Custom Prompt */}
            {activeContext?.customPrompt && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-800 mb-2">Custom Prompt</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {activeContext.customPrompt}
                </p>
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={onProceed}
                  disabled={!canGenerate}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    canGenerate
                      ? 'bg-brand-cta text-white hover:bg-brand-cta-hover'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {!selfieId ? 'Processing upload...' : 
                   !hasEnoughCredits ? t('insufficientCredits') : 
                   t('generatePhoto')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


