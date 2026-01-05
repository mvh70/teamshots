'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import type { MobileStep } from '@/components/customization/PhotoStyleSettings'
import { PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { PACKAGES_CONFIG } from '@/config/packages'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import GenerateButton from '@/components/generation/GenerateButton'
import { hasUneditedEditableFields, getUneditedEditableFieldNames } from '@/domain/style/userChoice'
import { useAnalytics } from '@/hooks/useAnalytics'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import type { GenerationPageData, ContextOption } from './actions'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import { FlowProgressDock } from '@/components/generation/navigation'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useOnboardingState } from '@/lib/onborda/hooks'
import Header from '@/app/[locale]/app/components/Header'
import { loadClothingColors, saveClothingColors, loadStyleSettings, saveStyleSettings } from '@/lib/clothing-colors-storage'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

const GenerationTypeSelector = dynamic(() => import('@/components/GenerationTypeSelector'), { ssr: false })

interface StartGenerationClientProps {
  initialData: GenerationPageData
  keyFromQuery?: string
}

export default function StartGenerationClient({ initialData, keyFromQuery }: StartGenerationClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { track } = useAnalytics()
  const t = useTranslations('app.sidebar.generate')
  const tCustomize = useTranslations('generate.customize')
  const skipUpload = useMemo(() => searchParams.get('skipUpload') === '1', [searchParams])
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])
  
  // Check for success state after checkout
  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')
  
  // Initialize state from server data - no useEffect needed!
  const selectedSelfies = initialData.selectedSelfies
  const ownedPackages = initialData.ownedPackages || []
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  const { credits: userCredits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const { href: buyCreditsHref } = useBuyCreditsLink()
  
  // Add returnTo parameter to buy credits link
  const buyCreditsHrefWithReturn = useMemo(() => {
    const returnTo = encodeURIComponent(pathname)
    const separator = buyCreditsHref.includes('?') ? '&' : '?'
    return `${buyCreditsHref}${separator}returnTo=${returnTo}`
  }, [buyCreditsHref, pathname])

  const {
    flags: flowFlags,
    markInFlow,
    clearFlow,
    hasSeenCustomizationIntro,
    hydrated,
    setCustomizationStepsMeta,
    customizationStepsMeta,
    visitedSteps
  } = useGenerationFlowState()
  const isMobile = useMobileViewport()
  const { context: onboardingContext } = useOnboardingState()

  const markGenerationFlow = useCallback(() => {
    markInFlow({ pending: true })
  }, [markInFlow])

  const clearGenerationFlow = useCallback(() => {
    clearFlow()
  }, [clearFlow])
  
  const personalFallbackLabel = t('fallbackPersonalStyle', { default: 'Personal Style' })
  const teamFallbackLabel = t('fallbackTeamStyle', { default: 'Team Style' })

  // Style state from server data
  const [activeContext, setActiveContext] = useState<ContextOption | null>(initialData.styleData.activeContext)
  const [availableContexts] = useState<ContextOption[]>(initialData.styleData.availableContexts)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(initialData.styleData.photoStyleSettings)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(initialData.styleData.originalContextSettings)
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialData.styleData.selectedPackageId)
  const [isGenerating, setIsGenerating] = useState(false)
  const [visitedMobileSteps, setVisitedMobileSteps] = useState<Set<string>>(() => new Set())
  
  // Plan info from server data
  const { isFreePlan, isProUser, isTeamAdmin, isTeamMember } = initialData.planInfo
  const subscriptionTier = initialData.planInfo.tier
  const fallbackPackageId = PACKAGES_CONFIG.defaultPlanPackage

  const headerThumbs = useMemo(() => {
    const items = selectedSelfies.length > 0 ? selectedSelfies : (keyFromQuery ? [{ id: 'legacy', key: keyFromQuery }] : [])
    return items
  }, [selectedSelfies, keyFromQuery])

  // Derived state: session is available from server
  const session = useMemo(() => initialData.session ? {
    user: {
      id: initialData.session.userId,
      role: initialData.session.role,
      person: initialData.session.personId ? {
        id: initialData.session.personId,
        teamId: initialData.session.teamId
      } : undefined
    }
  } : null, [initialData.session])

  // Preload face detection model early in the generation flow
  // This ensures the model is ready when users reach the selfie capture page
  useEffect(() => {
    console.log('[StartGenerationClient] Preloading face detection model...')
    preloadFaceDetectionModel()
  }, [])

  // ✅ KEEP: Redirect logic (legitimate side effect for navigation)
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    if (!skipUpload && !keyFromQuery && !isSuccess && session && hydrated) {
      markGenerationFlow()
      startTransition(() => {
        // Check if user has enough selfies to skip selfie upload flow
        if (hasEnoughSelfies(selectedSelfies.length)) {
          // User has enough selfies, skip directly to customization-intro
          router.push('/app/generate/customization-intro')
        } else {
          // Not enough selfies, go through selfie tips page first
          router.push('/app/generate/selfie-tips')
        }
      })
    }
  }, [skipUpload, keyFromQuery, router, isSuccess, session, markGenerationFlow, hydrated, selectedSelfies.length])

  // Clear pendingGeneration flag when returning from selfie flow
  useEffect(() => {
    // Don't run if we're starting a fresh flow (will be redirected by first useEffect)
    if (!skipUpload && !keyFromQuery && !isSuccess && session) {
      return
    }
    
    if (flowFlags.pendingGeneration) {
      clearGenerationFlow()
    }
  }, [flowFlags.pendingGeneration, skipUpload, keyFromQuery, isSuccess, session, clearGenerationFlow])

  // Track if we've loaded saved settings to avoid overwriting user changes
  const hasLoadedSavedSettingsRef = React.useRef(false)

  // Helper function to merge saved colors into settings
  // IMPORTANT: Only merges saved colors when clothingColors type is 'user-choice'
  // Never modifies predefined/preset colors - they remain as-is
  const mergeSavedColors = React.useCallback((settings: PhotoStyleSettingsType): PhotoStyleSettingsType => {
    const currentClothingColors = settings.clothingColors

    // CRITICAL: Only merge saved colors if type is 'user-choice'
    // If type is 'predefined', return settings unchanged (preserve preset values)
    if (!currentClothingColors || currentClothingColors.type !== 'user-choice') {
      return settings
    }

    const savedColors = loadClothingColors()
    if (!savedColors) return settings

    // Merge saved colors into user-choice settings
    return {
      ...settings,
      clothingColors: {
        type: 'user-choice',
        colors: {
          ...currentClothingColors.colors,
          ...savedColors // Saved colors take precedence
        }
      }
    }
  }, [])

  // Helper function to merge saved style settings into current settings
  // Only merges fields that are 'user-choice' type - preserves predefined/preset values
  const mergeSavedStyleSettings = React.useCallback((
    settings: PhotoStyleSettingsType,
    contextId?: string | null
  ): PhotoStyleSettingsType => {
    const savedSettings = loadStyleSettings(contextId)
    if (!savedSettings) return settings

    // Start with current settings
    const merged = { ...settings }

    // For each category in saved settings, only merge if current type is 'user-choice'
    const categoriesToMerge = [
      'background', 'clothing', 'clothingColors', 'shotType',
      'branding', 'expression', 'pose', 'customClothing'
    ] as const

    for (const key of categoriesToMerge) {
      const currentValue = settings[key] as { type?: string; style?: string } | undefined
      const savedValue = savedSettings[key]

      // Only merge if current settings allow user choice
      const isUserChoice = key === 'clothing'
        ? currentValue?.style === 'user-choice'
        : currentValue?.type === 'user-choice'

      if (isUserChoice && savedValue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (merged as any)[key] = savedValue
      }
    }

    return merged
  }, [])

  // Load saved style settings from session storage on mount
  // IMPORTANT: Only loads settings if current type is 'user-choice'
  // Predefined/preset values are never modified
  useEffect(() => {
    // Only load settings once when component is hydrated and ready
    if (!hydrated || !skipUpload || hasLoadedSavedSettingsRef.current) return

    const contextId = activeContext?.id

    setPhotoStyleSettings(prev => {
      // First merge saved style settings (all categories)
      let merged = mergeSavedStyleSettings(prev, contextId)
      // Then merge saved clothing colors (for backward compatibility)
      merged = mergeSavedColors(merged)
      hasLoadedSavedSettingsRef.current = true
      return merged
    })
  }, [hydrated, skipUpload, activeContext?.id, mergeSavedStyleSettings, mergeSavedColors])

  // Save all style settings to session storage whenever they change
  // IMPORTANT: Saves all user choices - this ensures settings survive page refresh
  useEffect(() => {
    // Skip saving during initial load
    if (!hasLoadedSavedSettingsRef.current || !hydrated || !skipUpload) return

    const contextId = activeContext?.id

    // Save all style settings
    saveStyleSettings(photoStyleSettings, contextId)

    // Also save clothing colors separately for backward compatibility
    const clothingColors = photoStyleSettings.clothingColors
    if (clothingColors?.type === 'user-choice' && clothingColors?.colors) {
      saveClothingColors(clothingColors.colors)
    }
  }, [photoStyleSettings, hydrated, skipUpload, activeContext?.id])

  const normalizeContextName = useCallback((rawName: string | null | undefined, index: number, total: number, type: 'personal' | 'team'): string => {
    const trimmed = (rawName ?? '').trim()
    if (trimmed && trimmed.toLowerCase() !== 'unnamed') {
      return trimmed
    }
    const base = type === 'team' ? teamFallbackLabel : personalFallbackLabel
    return total > 1 ? `${base} ${total - index}` : base
  }, [teamFallbackLabel, personalFallbackLabel])

  // Determine user access
  const hasTeamAccess = Boolean(session?.user?.person?.teamId)
  const hasTeamCredits = userCredits.team > 0
  const hasIndividualAccess = userCredits.individual > 0
  
  // Determine effective generation type
  // IMPORTANT: Free plan users always use personal credits (even team admins)
  // Their free trial credits are stored as personal (teamId: null)
  const effectiveGenerationType: 'personal' | 'team' = useMemo(() => {
    // If user explicitly selected a type, use that
    if (generationType) return generationType

    // Free plan users always use personal credits
    if (isFreePlan) return 'personal'

    // Team admins/members/pro users use team credits
    if (isTeamAdmin || isTeamMember || isProUser) return 'team'

    // Fallback logic for other users
    return hasIndividualAccess ? 'personal' : (hasTeamAccess && hasTeamCredits ? 'team' : 'personal')
  }, [generationType, isFreePlan, isTeamAdmin, isTeamMember, isProUser, hasIndividualAccess, hasTeamAccess, hasTeamCredits])

  const onTypeSelected = (type: 'personal' | 'team') => {
    setGenerationType(type)
  }
  
  const handleMobileStepChange = useCallback((step: MobileStep | null) => {
    const stepId = step?.custom?.id ?? step?.category?.key ?? null
    if (!stepId) return
    setVisitedMobileSteps(prev => {
      if (prev.has(stepId)) return prev
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }, [])

  const handleStepMetaChange = useCallback((meta: { editableSteps: number; allSteps: number; lockedSteps: number[] }) => {
    setCustomizationStepsMeta(meta)
  }, [setCustomizationStepsMeta])

  const handleBackToSelfies = useCallback(() => {
    // Navigate to the selfie selection page
    router.push('/app/generate/selfie')
  }, [router])

  const onProceed = async () => {
    if (!hasEnoughSelfies(selectedSelfies.length) || !effectiveGenerationType) {
      console.error(`Missing required data for generation: need at least ${MIN_SELFIES_REQUIRED} selfies`)
      return
    }

    if (isGenerating) return

    try {
      setIsGenerating(true)

      // Colors are now saved automatically via useEffect when they change
      // No need to save here explicitly

      if (session?.user?.id) {
        track('generation_started', {
          user_id: session.user.id,
          generation_type: effectiveGenerationType,
          selfie_count: selectedSelfies.length,
          style_context_id: activeContext?.id,
          package_id: selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage,
          is_free_plan: isFreePlan,
          subscription_tier: subscriptionTier
        })
      }

      const packageId = selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage
      const packageConfig = getPackageConfig(packageId)
      
      // Filter styleSettings to only include visible categories (defense-in-depth)
      const allowedKeys = new Set([
        ...packageConfig.visibleCategories,
        'packageId',
        'presetId',
        'aspectRatio',
        'subjectCount',
        'usageContext',
        'style'
      ])
      const filteredStyleSettings = Object.fromEntries(
        Object.entries({ ...photoStyleSettings, packageId })
          .filter(([key]) => allowedKeys.has(key as keyof typeof photoStyleSettings))
      )
      
      const creditSource = effectiveGenerationType === 'team' ? 'team' : 'individual'
      const payload: Record<string, unknown> = {
        creditSource,
        contextId: activeContext?.id,
        styleSettings: filteredStyleSettings,
        prompt: activeContext?.customPrompt || 'Professional headshot',
        selfieIds: selectedSelfies.map(s => s.id),
        // Debug flags
        debugMode: process.env.NODE_ENV !== 'production', // Enable debug mode only in development (logs prompts, saves intermediate files)
        // stopAfterStep removed - full flow will now execute
      }
      
      const response = await jsonFetcher<{ 
        success?: boolean
        error?: string
        accountMode?: {
          isPro: boolean
          redirectUrl: string
        }
      }>('/api/generations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      // Refresh credits in background to update sidebar
      refetchCredits()

      const redirectUrl = response.accountMode?.redirectUrl || 
        (session?.user?.person?.teamId ? '/app/generations/team' : '/app/generations/personal')
      clearGenerationFlow()
      router.push(redirectUrl)
      
    } catch (error) {
      console.error('Failed to start generation:', error)
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsGenerating(false)
    }
  }

  const teamName = session?.user?.person ? 'Team' : undefined
  
  useEffect(() => {
    setVisitedMobileSteps(new Set())
  }, [skipUpload])
  
  const hasEnoughCredits = (effectiveGenerationType === 'team' && userCredits.team >= PRICING_CONFIG.credits.perGeneration) ||
                          (effectiveGenerationType === 'personal' && userCredits.individual >= PRICING_CONFIG.credits.perGeneration)
  const hasRequiredSelfies = hasEnoughSelfies(selectedSelfies.length)

  const effectivePackageId = isFreePlan ? 'freepackage' : (selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage)

  const hasUneditedFields = originalContextSettings
    ? hasUneditedEditableFields(photoStyleSettings as Record<string, unknown>, originalContextSettings as Record<string, unknown>, effectivePackageId)
    : false

  // Get list of unedited fields for progress dock display
  const uneditedFields = React.useMemo(() => {
    if (!originalContextSettings) return []
    return getUneditedEditableFieldNames(
      photoStyleSettings as Record<string, unknown>,
      originalContextSettings as Record<string, unknown>,
      effectivePackageId
    )
  }, [photoStyleSettings, originalContextSettings, effectivePackageId])

  const hasVisitedClothingColorsIfEditable = React.useMemo(() => {
    if (!isMobile) return true

    const categorySettings = (originalContextSettings || photoStyleSettings) as Record<string, unknown>
    const clothingColorsSettings = categorySettings['clothingColors']
    const isClothingColorsEditable = !clothingColorsSettings ||
      (clothingColorsSettings as { type?: string }).type === 'user-choice'

    return !isClothingColorsEditable || visitedMobileSteps.has('clothingColors')
  }, [isMobile, visitedMobileSteps, originalContextSettings, photoStyleSettings])
  
  const canGenerate = hasEnoughCredits && hasRequiredSelfies && effectiveGenerationType && !hasUneditedFields && hasVisitedClothingColorsIfEditable
  
  const hasAnyCredits = userCredits.team > 0 || userCredits.individual > 0
  const selectedPackage = getPackageConfig(effectivePackageId)
  const selectedPhotoStyleLabel = activeContext?.name || selectedPackage.label
  const remainingCreditsForType = effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual
  const photoCreditsPerGeneration = calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)
  
  const shouldShowGenerationTypeSelector = false
  const pagePaddingClasses = skipUpload ? 'px-0 md:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'

  // Redirect to intro page if not seen yet (route-based intros)
  useEffect(() => {
    if (hydrated && skipUpload && !hasSeenCustomizationIntro) {
      router.replace('/app/generate/customization-intro')
    }
  }, [hydrated, skipUpload, hasSeenCustomizationIntro, router])

  if (isSuccess && (successType === 'individual_success' || successType === 'vip_success' || successType === 'seats_success')) {
    return <PurchaseSuccess />
  }

  if (!creditsLoading && !hasAnyCredits) {
    return (
      <div className={`${pagePaddingClasses} space-y-6`}>
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
                href={buyCreditsHrefWithReturn}
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

  if (!skipUpload && !hasEnoughSelfies(selectedSelfies.length) && !keyFromQuery && session && !isSuccess) {
    return (
      <div className={`${pagePaddingClasses} space-y-6`}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Redirecting to selfie selection...</p>
          </div>
        </div>
      </div>
    )
  }

  // Don't render while redirecting to intro
  if (!hydrated || (skipUpload && !hasSeenCustomizationIntro)) {
    return (
      <div className={`${pagePaddingClasses} space-y-6`}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
          {/* Progress Dock - Bottom Center (Desktop Only) */}
          <FlowProgressDock
            selfieCount={selectedSelfies.length}
            uneditedFields={uneditedFields}
            hasUneditedFields={hasUneditedFields}
            canGenerate={canGenerate}
            hasEnoughCredits={hasEnoughCredits}
            currentStep="customize"
            onNavigateToSelfies={handleBackToSelfies}
            onNavigateToCustomize={() => {}} // Already on customize page
            onGenerate={onProceed}
            onBuyCredits={() => router.push(buyCreditsHrefWithReturn)}
            isGenerating={isGenerating || isPending}
            hiddenScreens={onboardingContext.hiddenScreens}
            onNavigateToSelfieTips={() => router.push('/app/generate/selfie-tips?force=1')}
            onNavigateToCustomizationIntro={() => router.push('/app/generate/customization-intro?force=1')}
            customizationStepsMeta={customizationStepsMeta}
            visitedEditableSteps={visitedSteps}
          />
      
      <div className={`${pagePaddingClasses} space-y-8 pb-32 md:pb-52 w-full max-w-full overflow-x-hidden bg-white min-h-screen`}>
      {!skipUpload && (creditsLoading || !session) ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (!skipUpload && !activeContext && effectiveGenerationType === 'team' && isProUser && hasTeamAccess) ? (
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
          photoKey={keyFromQuery || ''}
          onTypeSelected={onTypeSelected}
          userCredits={userCredits}
          hasTeamAccess={hasTeamAccess}
          teamName={teamName}
        />
      ) : skipUpload ? (
        <>
          {/* Alert for insufficient credits - shown inline if needed */}
          {!hasEnoughCredits && (
            <div className="hidden md:block mb-6">
              <div className="p-4 bg-white/80 backdrop-blur-sm border border-amber-300/60 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                    <svg className="h-3.5 w-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900 mb-1">
                      {t('insufficientCredits')}
                    </p>
                    <p className="text-sm text-amber-800 leading-snug">
                      {t('insufficientCreditsMessage', {
                        required: calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration),
                        current: calculatePhotosFromCredits(effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual)
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header card with selfie thumbnails and summary - hidden completely */}
          <div className="hidden bg-white rounded-xl shadow-md border border-gray-200/60 p-4 sm:p-6">
            <h1 className="hidden text-xl sm:text-2xl font-bold text-gray-900 mb-3 tracking-tight">{t('readyToGenerate')}</h1>
            
            {/* Alternative Layout: More balanced card-based approach */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* Left Section: Thumbnails and Summary */}
              <div className="flex gap-5 lg:flex-1 min-w-0">
                {/* Selected Selfie Thumbnails */}
                <div className="flex-none">
                  <div className={`grid ${headerThumbs.length <= 2 ? 'grid-flow-col auto-cols-max grid-rows-1' : 'grid-rows-2 grid-flow-col'} gap-2.5`}>
                    {headerThumbs.map((s) => (
                      <div key={s.id} className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 border-gray-200 shadow-md ring-2 ring-white">
                        <Image
                          src={`/api/files/get?key=${encodeURIComponent(s.key)}`}
                          alt="Selected selfie"
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <GenerationSummaryTeam
                    type={effectiveGenerationType}
                    styleLabel={selectedPhotoStyleLabel}
                    remainingCredits={remainingCreditsForType}
                    perGenCredits={PRICING_CONFIG.credits.perGeneration}
                    showGenerateButton={false}
                    showCustomizeHint={false}
                    teamName={teamName || undefined}
                    showTitle={false}
                    plain
                    inlineHint
                  />
                </div>
              </div>

              {/* Right Section: Credits and Generate Action */}
              <div className="hidden lg:flex-none lg:w-64 xl:w-72">
                <div className="space-y-4">
                  {!hasEnoughCredits && (
                    <div className="p-3 bg-white/80 backdrop-blur-sm border border-amber-300/60 rounded-lg shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                          <svg className="h-3.5 w-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-900 mb-1">
                            {t('insufficientCredits')}
                          </p>
                          <p className="text-xs text-amber-800 leading-snug">
                            {t('insufficientCreditsMessage', {
                              required: calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration),
                              current: calculatePhotosFromCredits(effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual)
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="hidden text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cost per generation</div>
                  <div className="hidden mb-4">
                    <div className="text-xl lg:text-2xl font-bold text-gray-900 leading-none">{photoCreditsPerGeneration}</div>
                    <div className="text-xs lg:text-sm text-gray-600">photo credits</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Page Header - matches intro pages typography */}
          <div className="hidden md:block pt-8 md:pt-10 space-y-3">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
              {tCustomize('title')}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
              {tCustomize('subtitle')}
            </p>
          </div>

          {/* Context Selection for Personal and Team Generations - Hide for free plan users */}
          {!isFreePlan && (effectiveGenerationType === 'personal' || effectiveGenerationType === 'team') && (
            <div className="hidden md:block bg-white rounded-xl shadow-md border border-gray-200/60 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">
                {effectiveGenerationType === 'personal' ? t('selectPhotoStyle') : 'Select Team Photo Style'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <select
                    value={activeContext?.id || (ownedPackages.length > 1 ? `package_${selectedPackageId}` : 'freestyle')}
                    onChange={async (e) => {
                      const value = e.target.value
                      if (value === 'freestyle') {
                        setActiveContext(null)
                        const fallbackPackage = getPackageConfig(fallbackPackageId)
                        setSelectedPackageId(fallbackPackageId)
                        // Freestyle packages are always user-choice, so merge saved colors
                        const newSettings = mergeSavedColors(fallbackPackage.defaultSettings)
                        setPhotoStyleSettings(newSettings)
                        setOriginalContextSettings(fallbackPackage.defaultSettings)
                      } else if (value.startsWith('package_')) {
                        const pkgId = value.replace('package_', '')
                        setActiveContext(null)
                        setSelectedPackageId(pkgId)
                        const pkg = getPackageConfig(pkgId)
                        // Packages are always user-choice, so merge saved colors
                        const newSettings = mergeSavedColors(pkg.defaultSettings)
                        setPhotoStyleSettings(newSettings)
                        setOriginalContextSettings(pkg.defaultSettings)
                      } else {
                        const selectedContext = availableContexts.find(ctx => ctx.id === value)
                        if (selectedContext) {
                          const { ui, pkg, context } = await loadStyleByContextId(selectedContext.id)
                          const contextIndex = availableContexts.findIndex((ctx) => ctx.id === selectedContext.id)
                          const effectiveType = isProUser ? (generationType ?? 'personal') : 'personal'
                          const updatedName = normalizeContextName(
                            context?.name ?? selectedContext.name,
                            contextIndex === -1 ? availableContexts.length : contextIndex,
                            availableContexts.length || 1,
                            effectiveType
                          )
                          const enrichedContext = {
                            id: selectedContext.id,
                            name: updatedName,
                            customPrompt: (context?.settings as Record<string, unknown> | undefined)?.['customPrompt'] as string | null | undefined ?? null,
                            settings: context?.settings ?? selectedContext.settings,
                            backgroundPrompt: (context?.settings as Record<string, unknown> | undefined)?.['backgroundPrompt'] as string | undefined,
                            stylePreset: (context?.settings as Record<string, unknown> | undefined)?.['stylePreset'] as string | undefined
                          }
                          setActiveContext(enrichedContext)
                          // CRITICAL: Only merge saved colors if context allows user-choice
                          // If type is 'predefined', use ui as-is (preserve preset values)
                          const newSettings = ui.clothingColors?.type === 'user-choice' 
                            ? mergeSavedColors(ui) 
                            : ui // Predefined contexts: use preset values, never override with saved colors
                          setPhotoStyleSettings(newSettings)
                          setSelectedPackageId(pkg.id)
                          setOriginalContextSettings(ui)
                        }
                      }
                    }}
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
                  >
                    {availableContexts.map((context) => (
                      <option key={context.id} value={context.id}>
                        {context.name}
                      </option>
                    ))}
                    {ownedPackages.length > 1 ? (
                      ownedPackages.map(pkg => (
                        <option key={pkg.packageId} value={`package_${pkg.packageId}`}>
                          {pkg.name} (all settings customizable)
                        </option>
                      ))
                    ) : (
                      <option value="freestyle">{t('freestyle')}</option>
                    )}
                  </select>
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                    {activeContext ? 
                      (effectiveGenerationType === 'personal' ? t('predefinedStyle') : t('predefinedTeamStyle')) : 
                      (availableContexts.length > 0 ? 
                        (effectiveGenerationType === 'personal' ? t('freestyleDescription') : t('freestyleTeamDescription')) : 
                        (effectiveGenerationType === 'personal' ? t('freestyleOnlyDescription') : t('freestyleTeamOnlyDescription')))
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Package Selector - Hide for free package contexts or predefined styles */ }
          {/* Removed as integrated into main dropdown */}

          {/* Photo Style Settings - Mobile */ }
          <div className="md:hidden pb-24 w-full max-w-full overflow-x-hidden">
            <div className="space-y-6 w-full max-w-full overflow-x-hidden">
              <StyleSettingsSection
                value={photoStyleSettings}
                onChange={setPhotoStyleSettings}
                readonlyPredefined={!!activeContext}
                originalContextSettings={originalContextSettings}
                showToggles={false}
                packageId={effectivePackageId}
                isFreePlan={isFreePlan}
                teamContext={effectiveGenerationType === 'team'}
                noContainer
                onMobileStepChange={handleMobileStepChange}
                onSwipeBack={() => router.push('/app/generate/customization-intro')}
                onStepMetaChange={handleStepMetaChange}
                topHeader={<Header standalone showBackToDashboard />}
              />
            </div>
          </div>

          {/* Photo Style Settings - Desktop */}
          <div className="space-y-6">
            <StyleSettingsSection
              value={photoStyleSettings}
              onChange={setPhotoStyleSettings}
              readonlyPredefined={!!activeContext}
              originalContextSettings={originalContextSettings}
              showToggles={false}
              packageId={effectivePackageId}
              isFreePlan={isFreePlan}
              teamContext={effectiveGenerationType === 'team'}
              className="hidden md:block"
              noContainer
              onStepMetaChange={setCustomizationStepsMeta}
              highlightedField={uneditedFields.length > 0 ? uneditedFields[0] : undefined}
            />
          </div>

          {/* Desktop Generate Button */}
          <div className="hidden md:block pt-8 space-y-3">
            {!hasEnoughCredits ? (
              <Link
                href={buyCreditsHrefWithReturn}
                className="w-full inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-primary via-brand-primary to-indigo-600 rounded-xl shadow-lg hover:shadow-2xl hover:from-brand-primary-hover hover:via-brand-primary-hover hover:to-indigo-700 transform hover:-translate-y-1 active:translate-y-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                {t('buyMoreCredits')}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onProceed}
                disabled={!canGenerate || isPending || isGenerating}
                className={`w-full px-8 py-4 text-base font-semibold text-white rounded-xl shadow-lg transform transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                  canGenerate && !isPending && !isGenerating
                    ? 'bg-gradient-to-r from-brand-primary via-brand-primary to-indigo-600 hover:shadow-2xl hover:from-brand-primary-hover hover:via-brand-primary-hover hover:to-indigo-700 hover:-translate-y-1 active:translate-y-0'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {isGenerating || isPending ? t('generating', { default: 'Generating...' }) : t('generatePhoto')}
              </button>
            )}
            {hasUneditedFields && (
              <p className="text-center text-sm text-gray-500">
                {t('customizeFieldsFirst', { default: 'Customize all highlighted fields to continue' })}
              </p>
            )}
          </div>

          {/* Custom Prompt */}
          {activeContext?.customPrompt && (
            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-6 sm:p-8 mt-8">
              <div className="pt-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 tracking-tight">Custom Prompt</h3>
                <p className="text-sm text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 rounded-lg leading-relaxed border border-gray-200/40">
                  {activeContext.customPrompt}
                </p>
              </div>
            </div>
          )}

          {/* Fixed sticky button at bottom - Mobile (Restored for non-desktop) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white pt-4 pb-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            {!hasEnoughCredits ? (
              <Link
                href={buyCreditsHrefWithReturn}
                className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                style={{ 
                  background: `linear-gradient(to right, ${BRAND_CONFIG.colors.cta}, ${BRAND_CONFIG.colors.ctaHover})`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${BRAND_CONFIG.colors.ctaHover}, #4F46E5)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${BRAND_CONFIG.colors.cta}, ${BRAND_CONFIG.colors.ctaHover})`
                }}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                {t('buyMoreCredits')}
              </Link>
            ) : (
              <>
                {!hasVisitedClothingColorsIfEditable && (
                  <p className="text-xs text-gray-500 text-center mb-2">
                    {t('customizeFirstTooltipMobile')}
                  </p>
                )}
                <GenerateButton
                  onClick={onProceed}
                  disabled={!canGenerate || isPending || isGenerating}
                  isGenerating={isGenerating || isPending}
                  size="md"
                  disabledReason={
                    !hasVisitedClothingColorsIfEditable
                      ? t('customizeFirstTooltipMobile')
                      : hasUneditedFields
                        ? t('customizeFirstTooltipMobile')
                        : undefined
                  }
                  integrateInPopover={hasUneditedFields && hasVisitedClothingColorsIfEditable}
                >
                  {t('generatePhoto')}
                </GenerateButton>
              </>
            )}
          </div>
        </>
      ) : null}
      </div>
    </>
  )
}

