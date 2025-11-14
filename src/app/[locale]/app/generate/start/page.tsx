'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import PackageSelector from '@/components/packages/PackageSelector'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyle, loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import { hasUserDefinedFields } from '@/domain/style/userChoice'

const GenerationTypeSelector = dynamic(() => import('@/components/GenerationTypeSelector'), { ssr: false })

export default function StartGenerationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations('app.sidebar.generate')
  const { isFreePlan, uiTier, tier: subscriptionTier } = usePlanInfo()
  const keyFromQuery = useMemo(() => searchParams.get('key') || '', [searchParams])
  const skipUpload = useMemo(() => searchParams.get('skipUpload') === '1', [searchParams])
  const [key, setKey] = useState<string>('')
  const [, setSelfieId] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean>(Boolean(keyFromQuery))
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  const { credits: userCredits, loading: creditsLoading } = useCredits()
  const { href: buyCreditsHref } = useBuyCreditsLink()
  const personalFallbackLabel = t('fallbackPersonalStyle', { default: 'Personal Style' })
  const teamFallbackLabel = t('fallbackTeamStyle', { default: 'Team Style' })
  type ContextOption = {
    id: string
    name: string
    customPrompt?: string | null
    settings?: Record<string, unknown>
  }

  const [activeContext, setActiveContext] = useState<{
    id: string
    name: string
    customPrompt?: string | null
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
  } | null>(null)
  const [availableContexts, setAvailableContexts] = useState<ContextOption[]>([])
  const [contextLoaded, setContextLoaded] = useState(false)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [selectedSelfies, setSelectedSelfies] = useState<Array<{ id: string; key: string }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const headerThumbs = useMemo(() => {
    const items = selectedSelfies.length > 0 ? selectedSelfies : (key ? [{ id: 'legacy', key }] : [])
    return items
  }, [selectedSelfies, key])

  // use shared hasUserDefinedFields utility

  useEffect(() => {
    // Keep local state in sync if query changes
    if (keyFromQuery && !key) {
      setKey(keyFromQuery)
      
      // Find existing selfie by key
      findSelfieByKey(keyFromQuery).then((id) => {
        if (id) {
          setSelfieId(id)
        }
      })
      
      // Check if we have enough selected selfies before approving
      // This will be checked again when selectedSelfies is loaded
    }
  }, [keyFromQuery, key])
  
  // Check if we should approve based on selected selfies count
  // Only auto-approve if we have keyFromQuery AND at least 2 selfies
  // Don't override manual approval state from onSelfieApproved
  useEffect(() => {
    if (keyFromQuery && selectedSelfies.length >= 2) {
      setIsApproved(true)
    } else if (keyFromQuery && selectedSelfies.length < 2) {
      // If we have a key from query but not enough selfies, keep upload flow open
      setIsApproved(false)
    }
  }, [keyFromQuery, selectedSelfies.length])

  useEffect(() => {
    // If coming from selection step, check if we have enough selfies before approving
    if (skipUpload && !isApproved) {
      if (selectedSelfies.length >= 2) {
        setIsApproved(true)
      }
    }
  }, [skipUpload, isApproved, selectedSelfies.length])

  const findSelfieByKey = async (key: string): Promise<string | undefined> => {
    try {
      const { id } = await jsonFetcher<{ id: string }>(`/api/uploads/find-by-key?key=${encodeURIComponent(key)}`, {
        credentials: 'include' // Required for Safari to send cookies
      })
      return id
    } catch (error) {
      console.error('Error finding selfie by key:', error)
      return undefined
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

  useEffect(() => {
    const fetchSelected = async () => {
      try {
        const res = await jsonFetcher<{ selfies: { id: string; key: string }[] }>('/api/selfies/selected', { credentials: 'include' })
        const selfies = res.selfies || []
        setSelectedSelfies(selfies)
        
        // If no skipUpload flag and we have less than 2 selfies selected, redirect to selection page
        if (!skipUpload && selfies.length < 2 && !keyFromQuery) {
          router.push('/app/generate/selfie')
        }
      } catch {
        setSelectedSelfies([])
        // If no skipUpload flag, redirect to selection page
        if (!skipUpload && !keyFromQuery) {
          router.push('/app/generate/selfie')
        }
      }
    }
    if (session?.user?.id) {
      fetchSelected()
    }
  }, [session?.user?.id, skipUpload, keyFromQuery, router])

  const normalizeContextName = useCallback((rawName: string | null | undefined, index: number, total: number, type: 'personal' | 'team'): string => {
    const trimmed = (rawName ?? '').trim()
    if (trimmed && trimmed.toLowerCase() !== 'unnamed') {
      return trimmed
    }
    const base = type === 'team' ? teamFallbackLabel : personalFallbackLabel
    return total > 1 ? `${base} ${total - index}` : base
  }, [teamFallbackLabel, personalFallbackLabel])

  // Determine user access and whether to show generation type selector (needed for effectiveGenerationType)
  const hasTeamAccess = Boolean(session?.user?.person?.teamId)
  const hasTeamCredits = userCredits.team > 0
  const hasIndividualAccess = userCredits.individual > 0
  
  // Determine effective generation type (use state if set, otherwise determine from user role/subscription)
  // This ensures correct display even before useEffect sets generationType
  // Priority: role checks first (team_admin/team_member always use team credits), then subscription tier, then fallback
  const isTeamAdmin = session?.user?.role === 'team_admin'
  const isTeamMember = session?.user?.role === 'team_member'
  const isProUser = subscriptionTier === 'pro' // Check actual subscription tier, not UI tier (pro users on free period still use team credits)
  const effectiveGenerationType: 'personal' | 'team' = useMemo(() => 
    generationType || 
    (isTeamAdmin || isTeamMember || isProUser
      ? 'team' 
      : (hasIndividualAccess ? 'personal' : (hasTeamAccess && hasTeamCredits ? 'team' : 'personal'))),
    [generationType, isTeamAdmin, isTeamMember, isProUser, hasIndividualAccess, hasTeamAccess, hasTeamCredits]
  )

  // Fetch contexts when generation type is determined
  useEffect(() => {
    const fetchContexts = async () => {
      const contextType: 'personal' | 'team' | null = uiTier === 'pro' ? generationType : 'personal'
      if (!session?.user?.id || !contextType) return
      
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
        const endpoint = contextType === 'personal' ? '/api/styles/personal' : '/api/styles/team'
        const contextData = await jsonFetcher<{ contexts?: unknown[]; activeContext?: unknown }>(endpoint)
        const rawContexts = (contextData.contexts || []) as Array<{ id: string; name?: string | null; customPrompt?: string | null; settings?: Record<string, unknown> }>
        const total = rawContexts.length
        const contexts = rawContexts.map((context, index) => ({
          id: context.id,
          name: normalizeContextName(context.name, index, total, contextType),
          customPrompt: context.customPrompt ?? null,
          settings: context.settings
        }))
        setAvailableContexts(contexts)
          
          // Set active context if available
          let resolvedActiveContext: ContextOption | null = null
          if (contextData.activeContext) {
            const activeFromList = contexts.find((ctx) => ctx.id === (contextData.activeContext as { id: string }).id) || null
            resolvedActiveContext = activeFromList
            setActiveContext(activeFromList ? { ...activeFromList } : null)
          } else {
            // Default to freestyle if no context is active
            setActiveContext(null)
          }
          
          // Load deserialized settings for active context if available
          if (resolvedActiveContext) {
            // loadStyleByContextId extracts packageId from the context settings in the database
            const { ui, pkg, context } = await loadStyleByContextId(resolvedActiveContext.id)
            setPhotoStyleSettings(ui)
            setOriginalContextSettings(ui) // Store original context settings
            
            // Use the packageId from the loaded package (already extracted from database context)
            // This will be 'freepackage', 'headshot1', or any other package the team admin set
            const contextPackageId = pkg.id
            setSelectedPackageId(contextPackageId)
            if (context) {
              const contextIndex = contexts.findIndex((ctx) => ctx.id === context.id)
              const updatedName = normalizeContextName(
                context.name,
                contextIndex === -1 ? contexts.length : contextIndex,
                contexts.length || 1,
                effectiveGenerationType
              )
              const enrichedContext = {
                id: context.id,
                name: updatedName,
                customPrompt: context.customPrompt ?? null,
                settings: context.settings,
                backgroundPrompt: context.settings?.['backgroundPrompt'] as string | undefined,
                stylePreset: context.stylePreset
              }
              setActiveContext(enrichedContext)
              setAvailableContexts((prev) =>
                prev.map((ctx) =>
                  ctx.id === enrichedContext.id
                    ? { ...ctx, name: enrichedContext.name, customPrompt: enrichedContext.customPrompt ?? ctx.customPrompt }
                    : ctx
                )
              )
            }
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
  }, [session?.user?.id, generationType, isFreePlan, selectedPackageId, uiTier, normalizeContextName, effectiveGenerationType])



  const onTypeSelected = (type: 'personal' | 'team') => {
    setGenerationType(type)
  }

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (selectedSelfies.length < 2 || !effectiveGenerationType) {
      console.error('Missing required data for generation: need at least 2 selfies')
      return
    }

    // Prevent double-clicks
    if (isGenerating) return

    try {
      setIsGenerating(true)

      // Ensure packageId is set (default to headshot1 if not selected)
      const packageId = selectedPackageId || PRICING_CONFIG.defaultSignupPackage
      
      const payload: Record<string, unknown> = {
        contextId: activeContext?.id,
        styleSettings: { ...photoStyleSettings, packageId },
        prompt: activeContext?.customPrompt || 'Professional headshot',
        selfieIds: selectedSelfies.map(s => s.id)
      }
      
      // Create generation request (server decides mode and credits)
      const response = await jsonFetcher<{ 
        success?: boolean; 
        error?: string;
        accountMode?: {
          isPro: boolean;
          redirectUrl: string;
        }
      }>('/api/generations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      // Use account mode from response to avoid redundant API call
      const redirectUrl = response.accountMode?.redirectUrl || 
        (session?.user?.person?.teamId ? '/app/generations/team' : '/app/generations/personal')
      router.push(redirectUrl)
      
    } catch (error) {
      console.error('Failed to start generation:', error)
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsGenerating(false)
    }
  }

  const teamName = session?.user?.person?.team?.name
  
  // Check if user has enough credits for generation
  const hasEnoughCredits = (effectiveGenerationType === 'team' && userCredits.team >= PRICING_CONFIG.credits.perGeneration) || 
                          (effectiveGenerationType === 'personal' && userCredits.individual >= PRICING_CONFIG.credits.perGeneration)
  // Require at least 2 selfies for individual generation flow
  const hasRequiredSelfies = selectedSelfies.length >= 2
  const canGenerate = hasEnoughCredits && hasRequiredSelfies && effectiveGenerationType
  
  // Check if user has any credits at all
  const hasAnyCredits = userCredits.team > 0 || userCredits.individual > 0

  // Resolve selected photo style label for display
  const selectedPackage = getPackageConfig(selectedPackageId || PRICING_CONFIG.defaultSignupPackage)
  const selectedPhotoStyleLabel = selectedPackage.label
  const remainingCreditsForType = effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual
  const showCustomizeHint = hasUserDefinedFields(photoStyleSettings)
  
  // No client-side choice: server enforces mode
  const shouldShowGenerationTypeSelector = false

  // Determine generation type based on strict rules:
  // - Pro users and team admins ALWAYS use team credits
  // - Invited team members ALWAYS use team credits
  // - Individual users ALWAYS use personal credits
  useEffect(() => {
    if (!creditsLoading && contextLoaded && isApproved && !generationType) {
      // Check if user is a team admin - they always use team credits (regardless of hasTeamAccess)
      const checkIsTeamAdmin = session?.user?.role === 'team_admin'
      if (checkIsTeamAdmin) {
        setGenerationType('team')
        return
      }

      // Check if user is an invited team member - they always use team credits
      const checkIsTeamMember = session?.user?.role === 'team_member'
      if (checkIsTeamMember) {
        setGenerationType('team')
        return
      }

      // Check if user has pro subscription - they always use team credits (check actual tier, not UI tier)
      if (subscriptionTier === 'pro') {
          setGenerationType('team')
          return
      }

      // Individual users use personal credits
      if (hasIndividualAccess) {
        setGenerationType('personal')
        return
      }

      // Fallback: if individual user has no personal credits but has team access and team credits
      if (hasTeamAccess && hasTeamCredits) {
        setGenerationType('team')
        return
      }
    }
  }, [creditsLoading, contextLoaded, isApproved, generationType, subscriptionTier, session?.user?.role, hasTeamAccess, hasIndividualAccess, hasTeamCredits])

  // If not coming from selection page and we don't have enough selfies, redirect immediately
  useEffect(() => {
    if (!skipUpload && selectedSelfies.length < 2 && !keyFromQuery && contextLoaded) {
      router.push('/app/generate/selfie')
    }
  }, [skipUpload, selectedSelfies.length, keyFromQuery, contextLoaded, router])

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
                href={buyCreditsHref}
                className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
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

  // If not coming from selection page and we don't have enough selfies, show loading while redirecting
  if (!skipUpload && selectedSelfies.length < 2 && !keyFromQuery) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Redirecting to selfie selection...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {creditsLoading || !contextLoaded ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (!activeContext && effectiveGenerationType === 'team' && uiTier === 'pro' && hasTeamAccess) ? (
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
      ) : skipUpload && shouldShowGenerationTypeSelector && !generationType ? (
        <GenerationTypeSelector
          uploadedPhotoKey={key}
          onTypeSelected={onTypeSelected}
          userCredits={userCredits}
          hasTeamAccess={hasTeamAccess}
          teamName={teamName}
        />
      ) : skipUpload ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">{t('readyToGenerate')}</h1>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
              <div className="flex gap-4 md:gap-6 md:flex-1 min-w-0">
                {/* Selected Selfie Thumbnails */}
                <div className="flex-none">
                  <div className={`grid ${headerThumbs.length <= 2 ? 'grid-flow-col auto-cols-max grid-rows-1' : 'grid-rows-2 grid-flow-col'} gap-2 max-w-[220px]`}>
                    {headerThumbs.map((s) => (
                      <div key={s.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-gray-200 shadow-sm">
                    <Image
                          src={`/api/files/get?key=${encodeURIComponent(s.key)}`}
                      alt="Selected selfie"
                          width={48}
                          height={48}
                      className="w-full h-full object-cover"
                    />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <GenerationSummaryTeam
                    type={effectiveGenerationType}
                    styleLabel={selectedPhotoStyleLabel}
                    remainingCredits={remainingCreditsForType}
                    perGenCredits={PRICING_CONFIG.credits.perGeneration}
                    showGenerateButton={false}
                    showCustomizeHint={showCustomizeHint}
                    teamName={teamName || undefined}
                    showTitle={false}
                    plain
                    inlineHint
                  />
                </div>
              </div>
              <div className="md:text-right md:flex-none md:w-60">
                <div className="text-2xl font-bold text-gray-900">{PRICING_CONFIG.credits.perGeneration} credits</div>
                <div className="text-sm text-gray-900">Cost per generation</div>
                <div className="mt-3 md:mt-4">
                  <button
                    onClick={onProceed}
                    disabled={!canGenerate || isGenerating}
                    className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canGenerate && !isGenerating
                        ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                        : 'bg-brand-primary/30 text-white/70 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Starting generation...
                      </span>
                    ) : (
                      t('generatePhoto')
                    )}
                  </button>
                </div>
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
                        current: effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual
                      })}
                    </p>
                    <Link
                      href={buyCreditsHref}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors"
                      style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
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
                    onChange={async (e) => {
                      if (e.target.value === 'freestyle') {
                        setActiveContext(null)
                        setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
                        setOriginalContextSettings(undefined)
                      } else {
                        const selectedContext = availableContexts.find(ctx => ctx.id === e.target.value)
                        if (selectedContext) {
                          // Fetch and deserialize the context properly using loadStyleByContextId
                          const { ui, pkg, context } = await loadStyleByContextId(selectedContext.id)
                          const contextIndex = availableContexts.findIndex((ctx) => ctx.id === selectedContext.id)
                          const effectiveType = uiTier === 'pro' ? (generationType ?? 'personal') : 'personal'
                          const updatedName = normalizeContextName(
                            context?.name ?? selectedContext.name,
                            contextIndex === -1 ? availableContexts.length : contextIndex,
                            availableContexts.length || 1,
                            effectiveType
                          )
                          const enrichedContext = {
                            id: selectedContext.id,
                            name: updatedName,
                            customPrompt: context?.customPrompt ?? selectedContext.customPrompt ?? null,
                            settings: context?.settings ?? selectedContext.settings,
                            backgroundPrompt: context?.settings?.['backgroundPrompt'] as string | undefined,
                            stylePreset: context?.stylePreset
                          }
                          setActiveContext(enrichedContext)
                          setPhotoStyleSettings(ui)
                          setOriginalContextSettings(ui)
                          setSelectedPackageId(pkg.id)
                          setAvailableContexts((prev) =>
                            prev.map((ctx) =>
                              ctx.id === enrichedContext.id
                                ? { ...ctx, name: enrichedContext.name, customPrompt: enrichedContext.customPrompt ?? ctx.customPrompt }
                                : ctx
                            )
                          )
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
          <StyleSettingsSection
            value={photoStyleSettings}
            onChange={setPhotoStyleSettings}
            readonlyPredefined={!!activeContext || isFreePlan || selectedPackageId === 'freepackage'}
            originalContextSettings={originalContextSettings}
            showToggles={!!activeContext && !isFreePlan && selectedPackageId !== 'freepackage'}
            packageId={selectedPackageId || PRICING_CONFIG.defaultSignupPackage}
          />

          {/* Custom Prompt */}
          {activeContext?.customPrompt && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <div className="pt-0">
                <h3 className="font-medium text-gray-800 mb-2">Custom Prompt</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {activeContext.customPrompt}
                </p>
              </div>
            </div>
          )}

          {/* Selfie selection UI removed here; thumbnails are shown in header */}
        </>
      ) : null}
    </div>
  )
}


