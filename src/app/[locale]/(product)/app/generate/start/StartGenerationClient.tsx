'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import type { MobileStep } from '@/components/customization/PhotoStyleSettings'
import { PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { PACKAGES_CONFIG } from '@/config/packages'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyleByContextId, setActiveStyle, clearActiveStyle } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import GenerateButton from '@/components/generation/GenerateButton'
import { useAnalytics } from '@/hooks/useAnalytics'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import type { GenerationPageData, ContextOption } from './actions'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import { FlowProgressDock, CustomizationMobileFooter } from '@/components/generation/navigation'
import type { CustomizationStepsMeta } from '@/lib/customizationSteps'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useOnboardingState } from '@/lib/onborda/hooks'
import Header from '@/app/[locale]/(product)/app/components/Header'
import { loadClothingColors, saveClothingColors, loadStyleSettings, saveStyleSettings } from '@/lib/clothing-colors-storage'
import { isUserChoice, hasValue, userChoice } from '@/domain/style/elements/base/element-types'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { useCustomizationCompletion } from '@/hooks/useCustomizationCompletion'

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
  const tNav = useTranslations('inviteDashboard.selfieSelection.mobile.navigation')
  const tProgressDock = useTranslations('generation.progressDock')
  const tStyleCategories = useTranslations('customization.photoStyle.categories')
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
    visitedSteps,
    setVisitedSteps,
    completedSteps,
    setCompletedSteps
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

  // LocalStorage key for persisting selected package when no context is active
  const SELECTED_PACKAGE_KEY = 'teamshots_selected_package'

  // Style state from server data
  const [activeContext, setActiveContext] = useState<ContextOption | null>(initialData.styleData.activeContext)
  const [availableContexts] = useState<ContextOption[]>(initialData.styleData.availableContexts)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(initialData.styleData.photoStyleSettings)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(initialData.styleData.originalContextSettings)
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialData.styleData.selectedPackageId)
  const [isGenerating, setIsGenerating] = useState(false)
  const [visitedMobileSteps, setVisitedMobileSteps] = useState<Set<string>>(() => new Set())
  const [acceptedVisitedStepKeys, setAcceptedVisitedStepKeys] = useState<Set<string>>(() => new Set())
  // Navigation methods exposed by PhotoStyleSettings for mobile sticky footer (use ref to avoid re-render loops)
  const navMethodsRef = React.useRef<{ goNext: () => void; goPrev: () => void; goToStep: (index: number) => void } | null>(null)
  // Step indicator props exposed by PhotoStyleSettings for sticky footer navigation
  const [stepIndicatorProps, setStepIndicatorProps] = useState<{ current: number; total: number; lockedSteps?: number[]; totalWithLocked?: number; currentAllStepsIndex?: number; visitedEditableSteps?: number[] } | undefined>(undefined)

  // Stable callback for navigation ready - just store in ref, no state update
  const handleNavigationReady = useCallback((methods: { goNext: () => void; goPrev: () => void; goToStep: (index: number) => void }) => {
    navMethodsRef.current = methods
  }, [])

  // Memoized callback to prevent re-render loops from stepIndicatorProps updates
  const handleStepIndicatorChange = useCallback((props: typeof stepIndicatorProps) => {
    setStepIndicatorProps(prev => {
      // Only update if values actually changed
      if (!prev && !props) return prev
      if (!prev || !props) return props
      if (
        prev.current === props.current &&
        prev.total === props.total &&
        prev.totalWithLocked === props.totalWithLocked &&
        prev.currentAllStepsIndex === props.currentAllStepsIndex &&
        JSON.stringify(prev.lockedSteps) === JSON.stringify(props.lockedSteps) &&
        JSON.stringify(prev.visitedEditableSteps) === JSON.stringify(props.visitedEditableSteps)
      ) {
        return prev // No change, return same reference
      }
      return props
    })
  }, [])

  // Restore selected package from localStorage on mount (when no context is active)
  useEffect(() => {
    // Only restore if no active context from server
    if (initialData.styleData.activeContext) return

    try {
      const savedPackageId = localStorage.getItem(SELECTED_PACKAGE_KEY)
      if (savedPackageId && savedPackageId !== selectedPackageId) {
        // Verify the package is valid and owned
        const isOwnedPackage = initialData.ownedPackages?.some(p => p.packageId === savedPackageId)
        if (isOwnedPackage) {
          const pkg = getPackageConfig(savedPackageId)
          setSelectedPackageId(savedPackageId)
          setPhotoStyleSettings(pkg.defaultSettings)
          setOriginalContextSettings(pkg.defaultSettings)
        }
      }
    } catch {
      // Ignore localStorage errors (e.g., in private browsing mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only on mount

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
  // Track if user has explicitly made changes (to prevent auto-save on initial load)
  const hasUserMadeChangesRef = React.useRef(false)

  // Helper function to merge saved colors into settings
  // IMPORTANT: Only merges saved colors when clothingColors mode is 'user-choice'
  // Never modifies predefined/preset colors - they remain as-is
  const mergeSavedColors = React.useCallback((settings: PhotoStyleSettingsType): PhotoStyleSettingsType => {
    const currentClothingColors = settings.clothingColors

    // CRITICAL: Only merge saved colors if mode is 'user-choice'
    // If mode is 'predefined', return settings unchanged (preserve preset values)
    if (!currentClothingColors || !isUserChoice(currentClothingColors)) {
      return settings
    }

    const savedColors = loadClothingColors()
    if (!savedColors) return settings

    // Merge saved colors into user-choice settings
    const currentColors = hasValue(currentClothingColors) ? currentClothingColors.value : {}
    return {
      ...settings,
      clothingColors: userChoice({
        ...currentColors,
        ...savedColors // Saved colors take precedence
      })
    }
  }, [])

  // Helper function to merge saved style settings into current settings
  // CRITICAL: Only merges fields where current mode is 'user-choice'
  // Predefined values (set by admin) are NEVER overwritten by saved user preferences
  // Note: We intentionally use a GLOBAL key (no contextId) to ensure settings persist
  // across context/package changes. The merge logic handles predefined vs user-choice.
  const mergeSavedStyleSettings = React.useCallback((
    settings: PhotoStyleSettingsType
  ): PhotoStyleSettingsType => {
    const savedSettings = loadStyleSettings() // Global key - no context-specific key
    if (!savedSettings) {
      return settings
    }

    // Start with current settings
    const merged = { ...settings }

    // For each category in saved settings, only merge if current mode is 'user-choice'
    const categoriesToMerge = [
      'background', 'clothing', 'clothingColors', 'shotType',
      'branding', 'expression', 'pose', 'customClothing'
    ] as const

    for (const key of categoriesToMerge) {
      const currentValue = settings[key] as { type?: string; style?: string; mode?: string; value?: unknown } | undefined
      const savedValue = savedSettings[key] as { type?: string; style?: string; mode?: string; value?: unknown } | undefined

      // Check if saved value has actual content (value property with data)
      const savedHasValue = savedValue?.value !== undefined

      // CRITICAL: Only merge if current mode is 'user-choice'
      // If mode is 'predefined', admin has locked this value - never overwrite
      const currentIsUserChoice = currentValue?.mode === 'user-choice'

      if (savedHasValue && currentValue && currentIsUserChoice) {
        // Restore user's saved selection for user-choice settings.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ; (merged as any)[key] = {
          ...currentValue,
          value: savedValue.value
        }
      }
      // If currentValue is undefined or mode is 'predefined', keep settings unchanged
      // - predefined: admin's value is authoritative, never overwrite
      // - undefined: package doesn't support this setting, don't add it
    }

    return merged
  }, [])

  // Mark as ready for saving after hydration (regardless of skipUpload)
  // This ensures saves work in all flows
  useEffect(() => {
    console.log('[Load Effect] Running. hydrated:', hydrated, 'hasLoadedSavedSettingsRef:', hasLoadedSavedSettingsRef.current, 'skipUpload:', skipUpload)
    if (!hydrated || hasLoadedSavedSettingsRef.current) {
      console.log('[Load Effect] Early return - already loaded or not hydrated')
      return
    }

    // If skipUpload is true, load saved settings first
    if (skipUpload) {
      console.log('[Load Effect] skipUpload is true, merging saved settings')
      setPhotoStyleSettings(prev => {
        // First merge saved style settings (all categories) - uses global key
        let merged = mergeSavedStyleSettings(prev)
        // Then merge saved clothing colors (for backward compatibility)
        merged = mergeSavedColors(merged)
        return merged
      })
    } else {
      console.log('[Load Effect] skipUpload is false, NOT merging saved settings')
    }

    // Mark as ready for saving (always, after hydration)
    hasLoadedSavedSettingsRef.current = true
    console.log('[Load Effect] Set hasLoadedSavedSettingsRef to true')
  }, [hydrated, skipUpload, mergeSavedStyleSettings, mergeSavedColors])

  // Save all style settings to session storage whenever they change
  // IMPORTANT: Only saves when user has explicitly made changes (not on initial load)
  // This prevents overwriting saved settings when page loads with a different package
  useEffect(() => {
    console.log('[Save Effect] Running. hasLoadedSavedSettingsRef:', hasLoadedSavedSettingsRef.current, 'hasUserMadeChangesRef:', hasUserMadeChangesRef.current, 'hydrated:', hydrated)
    // Skip saving during initial load, if not hydrated, or if user hasn't made changes
    if (!hasLoadedSavedSettingsRef.current || !hydrated || !hasUserMadeChangesRef.current) {
      console.log('[Save Effect] Early return - not ready to save or no user changes')
      return
    }

    console.log('[Save Effect] Saving settings:', photoStyleSettings)
    // Save all style settings with global key (no context-specific key)
    // This ensures settings persist regardless of which context/package is active
    saveStyleSettings(photoStyleSettings)

    // Also save clothing colors separately for backward compatibility
    const clothingColors = photoStyleSettings.clothingColors
    if (clothingColors && isUserChoice(clothingColors) && hasValue(clothingColors)) {
      saveClothingColors(clothingColors.value)
    }
    console.log('[Save Effect] Save complete')
  }, [photoStyleSettings, hydrated])

  // Wrapper for settings onChange that marks user as having made changes
  // Also tracks visited steps on desktop for FlowProgressDock progress display
  const handleSettingsChange = useCallback((newSettings: PhotoStyleSettingsType | ((prev: PhotoStyleSettingsType) => PhotoStyleSettingsType)) => {
    hasUserMadeChangesRef.current = true

    setPhotoStyleSettings(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings

      // On desktop, detect which fields changed and mark them as visited
      // Use setTimeout to avoid setting state inside state setter
      if (!isMobile && customizationStepsMeta?.stepKeys) {
        const changedIndices: number[] = []
        customizationStepsMeta.stepKeys.forEach((key, idx) => {
          const prevValue = (prev as Record<string, unknown>)[key]
          const newValue = (updated as Record<string, unknown>)[key]
          if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
            changedIndices.push(idx)
          }
        })

        if (changedIndices.length > 0) {
          // Schedule state update outside of the setter callback
          // Capture current visitedSteps in closure for merging
          const currentVisited = [...visitedSteps]
          setTimeout(() => {
            const newVisited = [...new Set([...currentVisited, ...changedIndices])]
            setVisitedSteps(newVisited)
          }, 0)
        }
      }

      return updated
    })
  }, [isMobile, customizationStepsMeta?.stepKeys, visitedSteps, setVisitedSteps])

  const normalizeContextName = useCallback((rawName: string | null | undefined, index: number, total: number, type: 'personal' | 'team'): string => {
    const trimmed = (rawName ?? '').trim()
    if (trimmed && trimmed.toLowerCase() !== 'unnamed') {
      return trimmed
    }
    const base = type === 'team' ? teamFallbackLabel : personalFallbackLabel
    return total > 1 ? `${base} ${total - index}` : base
  }, [teamFallbackLabel, personalFallbackLabel])

  // Determine user access
  // NEW CREDIT MODEL: All credits are on person, team pool is just for distribution
  const hasTeamAccess = Boolean(session?.user?.person?.teamId)
  const hasTeamCredits = hasTeamAccess && userCredits.person > 0  // Team member with credits
  const hasIndividualAccess = userCredits.person > 0  // Anyone with credits

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
    setAcceptedVisitedStepKeys(prev => {
      if (prev.has(stepId)) return prev
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }, [])

  const handleCategoryVisit = useCallback((categoryKey: string) => {
    setAcceptedVisitedStepKeys(prev => {
      if (prev.has(categoryKey)) return prev
      const next = new Set(prev)
      next.add(categoryKey)
      return next
    })
    if (!customizationStepsMeta?.stepKeys) return
    const index = customizationStepsMeta.stepKeys.indexOf(categoryKey)
    if (index < 0) return
    if (visitedSteps.includes(index)) return
    setVisitedSteps(Array.from(new Set([...visitedSteps, index])))
  }, [customizationStepsMeta?.stepKeys, visitedSteps, setVisitedSteps])
  const acceptedOnVisitKeys = React.useMemo(() => ['clothing', 'clothingColors', 'pose', 'expression', 'branding'], [])

  // Track whether we've received fresh step meta from PhotoStyleSettings this session
  // This prevents auto-proceed from using stale cached sessionStorage values
  const hasReceivedFreshMeta = React.useRef(false)

  const handleStepMetaChange = useCallback((meta: CustomizationStepsMeta) => {
    hasReceivedFreshMeta.current = true
    setCustomizationStepsMeta(meta)
  }, [setCustomizationStepsMeta])

  const handleBackToSelfies = useCallback(() => {
    // Navigate to the selfie selection page
    router.push('/app/generate/selfie')
  }, [router])

  const onProceed = useCallback(async () => {
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

      let redirectUrl = response.accountMode?.redirectUrl ||
        (session?.user?.person?.teamId ? '/app/generations/team' : '/app/generations/personal')

      if (redirectUrl.includes('?')) {
        redirectUrl += '&new_generation=true'
      } else {
        redirectUrl += '?new_generation=true'
      }

      clearGenerationFlow()
      router.push(redirectUrl)

    } catch (error) {
      console.error('Failed to start generation:', error)
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsGenerating(false)
    }
  }, [
    selectedSelfies,
    effectiveGenerationType,
    isGenerating,
    session,
    track,
    activeContext,
    selectedPackageId,
    isFreePlan,
    subscriptionTier,
    photoStyleSettings,
    refetchCredits,
    clearGenerationFlow,
    router
  ])

  const teamName = session?.user?.person ? 'Team' : undefined

  useEffect(() => {
    setVisitedMobileSteps(new Set())
    if (!skipUpload) {
      setAcceptedVisitedStepKeys(new Set())
    }
  }, [skipUpload])

  // NEW CREDIT MODEL: Credits always belong to a person, not team pool
  // For both team and personal generation, check person's usable credits
  const hasEnoughCredits = userCredits.person >= PRICING_CONFIG.credits.perGeneration
  const hasRequiredSelfies = hasEnoughSelfies(selectedSelfies.length)

  const effectivePackageId = isFreePlan ? 'freepackage' : (selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage)
  const acceptedVisitStorageKey = React.useMemo(() => {
    const scope = activeContext?.id ? `context_${activeContext.id}` : `package_${effectivePackageId}`
    return `teamshots_accepted_visited_steps_${scope}`
  }, [activeContext?.id, effectivePackageId])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = sessionStorage.getItem(acceptedVisitStorageKey)
      if (!raw) {
        setAcceptedVisitedStepKeys(new Set())
        return
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setAcceptedVisitedStepKeys(new Set())
        return
      }

      const keys = parsed.filter((key): key is string => typeof key === 'string')
      setAcceptedVisitedStepKeys(new Set(keys))
    } catch {
      setAcceptedVisitedStepKeys(new Set())
    }
  }, [acceptedVisitStorageKey])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const keys = Array.from(acceptedVisitedStepKeys)
    if (keys.length > 0) {
      sessionStorage.setItem(acceptedVisitStorageKey, JSON.stringify(keys))
    } else {
      sessionStorage.removeItem(acceptedVisitStorageKey)
    }
  }, [acceptedVisitedStepKeys, acceptedVisitStorageKey])

  const completionState = useCustomizationCompletion({
    photoStyleSettings,
    originalContextSettings,
    packageId: effectivePackageId,
    stepKeys: customizationStepsMeta?.stepKeys,
    visitedStepKeys: acceptedVisitedStepKeys,
    isMobileViewport: isMobile,
    visitedMobileStepKeys: visitedMobileSteps,
    completionMode: 'values-only',
    includeDefaultValues: true,
    clothingColorsEditableWhenMissing: true,
    acceptedOnVisitKeys,
    acceptedOnVisitVisitedKeys: acceptedVisitedStepKeys
  })
  const uneditedFields = completionState.uneditedFields
  const hasUneditedFields = originalContextSettings ? completionState.hasUneditedFields : true
  const isCustomizationComplete = originalContextSettings ? completionState.isCustomizationComplete : false
  const valueBasedVisitedSteps = completionState.valueBasedVisitedStepIndices
  const hasVisitedClothingColorsIfEditable = completionState.hasVisitedClothingColorsIfEditable

  const uneditedFieldLabels = React.useMemo(() => {
    return uneditedFields
      .map((fieldKey) => {
        try {
          return tStyleCategories(`${fieldKey}.title`, { default: fieldKey })
        } catch {
          return ''
        }
      })
      .filter((label): label is string => Boolean(label && label.trim()))
  }, [uneditedFields, tStyleCategories])

  const fieldSpecificDisabledGenerateReason = React.useMemo(() => {
    if (!hasUneditedFields || uneditedFieldLabels.length === 0) return undefined

    if (uneditedFieldLabels.length === 1) {
      return tProgressDock('tooltips.setField', {
        field: uneditedFieldLabels[0],
        default: `Set your ${uneditedFieldLabels[0]} to generate`
      })
    }

    if (uneditedFieldLabels.length === 2) {
      const fields = `${uneditedFieldLabels[0]} and ${uneditedFieldLabels[1]}`
      return tProgressDock('tooltips.setFields', {
        fields,
        default: `Set ${fields} to generate`
      })
    }

    const fields = `${uneditedFieldLabels[0]}, ${uneditedFieldLabels[1]}`
    const count = uneditedFieldLabels.length - 2
    return tProgressDock('tooltips.setFieldsMore', {
      fields,
      count,
      default: `Set ${fields}, and ${count} more to generate`
    })
  }, [hasUneditedFields, tProgressDock, uneditedFieldLabels])

  const disabledGenerateReasonDesktop = React.useMemo(() => {
    if (!hasUneditedFields) return undefined
    return fieldSpecificDisabledGenerateReason ?? t('customizeFirstTooltip')
  }, [fieldSpecificDisabledGenerateReason, hasUneditedFields, t])

  const disabledGenerateReasonMobile = React.useMemo(() => {
    if (!hasUneditedFields) return undefined
    return fieldSpecificDisabledGenerateReason ?? t('customizeFirstTooltipMobile')
  }, [fieldSpecificDisabledGenerateReason, hasUneditedFields, t])

  const scrollToFirstIncompleteCard = React.useCallback(() => {
    const firstIncompleteField = uneditedFields[0]
    if (!firstIncompleteField) return

    const candidates = document.querySelectorAll<HTMLElement>(`[id="${firstIncompleteField}-settings"]`)
    const cardElement = Array.from(candidates).find(candidate => candidate.offsetParent !== null) ?? candidates[0]
    if (!cardElement) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cardElement.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center'
    })

    if (prefersReducedMotion) return

    cardElement.classList.remove('attention-pulse')
    void cardElement.getBoundingClientRect()
    cardElement.classList.add('attention-pulse')
    window.setTimeout(() => {
      cardElement.classList.remove('attention-pulse')
    }, 2000)
  }, [uneditedFields])

  // Persist completed steps to flow state so other pages can show progress
  React.useEffect(() => {
    if (
      completedSteps.length === valueBasedVisitedSteps.length &&
      completedSteps.every((step, idx) => step === valueBasedVisitedSteps[idx])
    ) {
      return
    }
    setCompletedSteps(valueBasedVisitedSteps)
  }, [completedSteps, valueBasedVisitedSteps, setCompletedSteps])

  const canGenerate = hasEnoughCredits && hasRequiredSelfies && effectiveGenerationType && isCustomizationComplete && hasVisitedClothingColorsIfEditable

  // NEW CREDIT MODEL: All usable credits are on person
  const hasAnyCredits = userCredits.person > 0
  const selectedPackage = getPackageConfig(effectivePackageId)
  const selectedPhotoStyleLabel = activeContext?.name || selectedPackage.label
  const remainingCreditsForType = userCredits.person  // Always use person credits
  const photoCreditsPerGeneration = calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)

  const shouldShowGenerationTypeSelector = false
  const pagePaddingClasses = skipUpload ? 'px-0 md:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'

  // Redirect to intro page if not seen yet (route-based intros)
  useEffect(() => {
    if (hydrated && skipUpload && !hasSeenCustomizationIntro) {
      router.replace('/app/generate/customization-intro')
    }
  }, [hydrated, skipUpload, hasSeenCustomizationIntro, router])

  // Auto-proceed to generation when ALL settings are predefined (no editable fields)
  // DISABLED: This feature was causing premature generation starts. Generation should only
  // happen when the user explicitly clicks the generate button.
  // TODO: Re-enable with proper fix if auto-proceed is needed for admin photostyles
  // const hasAttemptedAutoProceed = React.useRef(false)
  // useEffect(() => {
  //   if (hasAttemptedAutoProceed.current) return
  //   if (!hydrated || !skipUpload || !hasSeenCustomizationIntro) return
  //   if (isGenerating || isPending) return
  //   if (!hasReceivedFreshMeta.current) return
  //   if (!customizationStepsMeta || customizationStepsMeta.editableSteps === undefined) return
  //   if (customizationStepsMeta.editableSteps > 0) return
  //   if (!canGenerate) return
  //   hasAttemptedAutoProceed.current = true
  //   console.log('[StartGenerationClient] All settings predefined, auto-proceeding to generation')
  //   onProceed()
  // }, [hydrated, skipUpload, hasSeenCustomizationIntro, customizationStepsMeta, canGenerate, isGenerating, isPending, onProceed])

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

  if (!skipUpload && !keyFromQuery && session && !isSuccess) {
    return (
      <div className={`${pagePaddingClasses} space-y-6`}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
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

  const sharedStyleSettingsSectionProps = {
    value: photoStyleSettings,
    onChange: handleSettingsChange,
    readonlyPredefined: !!activeContext,
    originalContextSettings,
    showToggles: false as const,
    packageId: effectivePackageId,
    isFreePlan,
    teamContext: effectiveGenerationType === 'team',
    noContainer: true,
    onStepMetaChange: handleStepMetaChange,
    onCategoryVisit: handleCategoryVisit,
    acceptedOnVisitKeys,
    visitedStepKeys: acceptedVisitedStepKeys
  }

  return (
    <>
      {/* Progress Dock - Bottom Center (Desktop Only) */}
      <FlowProgressDock
        selfieCount={selectedSelfies.length}
        uneditedFields={uneditedFields}
        hasUneditedFields={!isCustomizationComplete}
        canGenerate={canGenerate}
        hasEnoughCredits={hasEnoughCredits}
        currentStep="customize"
        onNavigateToSelfies={handleBackToSelfies}
        onNavigateToCustomize={() => { }} // Already on customize page
        onGenerate={onProceed}
        onNavigateToDashboard={() => router.push('/app/dashboard')}
        onBuyCredits={() => router.push(buyCreditsHrefWithReturn)}
        isGenerating={isGenerating || isPending}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={
          // Use value-based visited steps: a step is "done" if it has a value, not just visited
          // This aligns the dock progress dots with the card badges
          valueBasedVisitedSteps
        }
        onAttemptDisabledGenerate={scrollToFirstIncompleteCard}
        disabledGenerateReason={disabledGenerateReasonDesktop}
      />

      <div className={`${pagePaddingClasses} space-y-8 pb-44 md:pb-52 w-full max-w-full overflow-x-hidden bg-white min-h-screen`}>
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
                          current: calculatePhotosFromCredits(userCredits.person)
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
                                current: calculatePhotosFromCredits(userCredits.person)
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
              <div className="hidden md:block relative overflow-hidden rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/30 to-white shadow-lg">
                {/* Decorative accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400" />

                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {effectiveGenerationType === 'personal' ? t('selectPhotoStyle') : 'Photo Style'}
                      </h2>
                    </div>
                  </div>

                  <div className="relative">
                    <select
                      value={activeContext?.id || (ownedPackages.length > 1 ? `package_${selectedPackageId}` : 'freestyle')}
                      onChange={async (e) => {
                        const value = e.target.value
                        if (value === 'freestyle') {
                          // Clear server-side active context if one exists
                          if (activeContext?.id) {
                            clearActiveStyle({ styleId: activeContext.id }).catch(() => { })
                          }
                          setActiveContext(null)
                          const fallbackPackage = getPackageConfig(fallbackPackageId)
                          setSelectedPackageId(fallbackPackageId)
                          // Persist package selection to localStorage
                          try { localStorage.setItem(SELECTED_PACKAGE_KEY, fallbackPackageId) } catch { }
                          // Freestyle packages are always user-choice, so merge saved settings and colors
                          let newSettings = mergeSavedStyleSettings(fallbackPackage.defaultSettings)
                          newSettings = mergeSavedColors(newSettings)
                          setPhotoStyleSettings(newSettings)
                          setOriginalContextSettings(fallbackPackage.defaultSettings)
                          // Mark that user has made changes - enables saving
                          hasUserMadeChangesRef.current = true
                        } else if (value.startsWith('package_')) {
                          const pkgId = value.replace('package_', '')
                          // Clear server-side active context if one exists
                          if (activeContext?.id) {
                            clearActiveStyle({ styleId: activeContext.id }).catch(() => { })
                          }
                          setActiveContext(null)
                          setSelectedPackageId(pkgId)
                          // Persist package selection to localStorage
                          try { localStorage.setItem(SELECTED_PACKAGE_KEY, pkgId) } catch { }
                          const pkg = getPackageConfig(pkgId)
                          // Packages are always user-choice, so merge saved settings and colors
                          let newSettings = mergeSavedStyleSettings(pkg.defaultSettings)
                          newSettings = mergeSavedColors(newSettings)
                          setPhotoStyleSettings(newSettings)
                          setOriginalContextSettings(pkg.defaultSettings)
                          // Mark that user has made changes - enables saving
                          hasUserMadeChangesRef.current = true
                        } else {
                          const selectedContext = availableContexts.find(ctx => ctx.id === value)
                          if (selectedContext) {
                            // Clear package selection from localStorage (context takes precedence)
                            try { localStorage.removeItem(SELECTED_PACKAGE_KEY) } catch { }
                            // Persist the selected style so it's restored on page reload
                            setActiveStyle({ styleId: selectedContext.id }).catch(() => {
                              // Silently ignore errors - the style will work for this session
                            })
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
                            // If mode is 'predefined', use ui as-is (preserve preset values)
                            const newSettings = ui.clothingColors && isUserChoice(ui.clothingColors)
                              ? mergeSavedColors(ui)
                              : ui // Predefined contexts: use preset values, never override with saved colors
                            setPhotoStyleSettings(newSettings)
                            setSelectedPackageId(pkg.id)
                            setOriginalContextSettings(ui)
                            // Mark that user has made changes - enables saving
                            hasUserMadeChangesRef.current = true
                          }
                        }
                      }}
                      className="w-full appearance-none px-5 py-3.5 pr-12 text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all cursor-pointer"
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
                    {/* Custom dropdown chevron */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Package Selector - Hide for free package contexts or predefined styles */}
            {/* Removed as integrated into main dropdown */}

            {isMobile ? (
              <div className="pb-24 w-full max-w-full overflow-x-hidden">
                <div className="space-y-6 w-full max-w-full overflow-x-hidden">
                  <StyleSettingsSection
                    {...sharedStyleSettingsSectionProps}
                    onMobileStepChange={handleMobileStepChange}
                    onSwipeBack={() => router.push('/app/generate/customization-intro')}
                    topHeader={<Header standalone showBackToDashboard />}
                    onNavigationReady={handleNavigationReady}
                    hideInlineNavigation={true}
                    onStepIndicatorChange={handleStepIndicatorChange}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <StyleSettingsSection
                  {...sharedStyleSettingsSectionProps}
                  enableDesktopProgressiveActivation={true}
                />
              </div>
            )}

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

            <CustomizationMobileFooter
              leftAction={{
                label: (stepIndicatorProps?.currentAllStepsIndex ?? 0) <= 1
                  ? tNav('selfies', { default: 'Selfies' })
                  : tNav('previous', { default: 'Previous' }),
                onClick: () => {
                  if ((stepIndicatorProps?.currentAllStepsIndex ?? 0) <= 1) {
                    router.push('/app/generate/selfie')
                    return
                  }
                  navMethodsRef.current?.goPrev()
                }
              }}
              rightAction={(stepIndicatorProps?.currentAllStepsIndex ?? 0) < ((stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1) - 1)
                ? {
                    label: tNav('next', { default: 'Next' }),
                    onClick: () => navMethodsRef.current?.goNext(),
                    tone: 'primary',
                    icon: 'chevron-right'
                  }
                : undefined}
              progressContent={
                <div className="pb-3 flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">{t('selfies', { default: 'Selfies' })}</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-secondary" />
                  </div>

                  <div className="h-4 w-px bg-gray-200" />

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">{t('customize', { default: 'Customize' })}</span>
                    <div className="flex items-center gap-1">
                      {customizationStepsMeta?.stepKeys?.map((key, idx) => {
                        const hasValue = !uneditedFields.includes(key)
                        const isLocked = customizationStepsMeta.lockedSteps?.includes(idx + 1)
                        const isCurrent = stepIndicatorProps?.currentAllStepsIndex === idx + 1

                        if (isLocked) {
                          return (
                            <LockClosedIcon
                              key={`progress-lock-${key}`}
                              className={`h-3 w-3 ${isCurrent ? 'text-gray-600' : 'text-gray-400'}`}
                            />
                          )
                        }

                        return (
                          <span
                            key={`progress-dot-${key}`}
                            className={`
                              rounded-full transition-all duration-300
                              ${isCurrent ? 'h-3 w-3' : 'h-2.5 w-2.5'}
                              ${hasValue ? 'bg-brand-secondary' : 'bg-brand-primary'}
                            `}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              }
            >
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
                <GenerateButton
                  onClick={onProceed}
                  disabled={!canGenerate || isPending || isGenerating}
                  isGenerating={isGenerating || isPending}
                  size="md"
                  disabledReason={
                    !hasVisitedClothingColorsIfEditable
                      ? (disabledGenerateReasonMobile || t('customizeFirstTooltipMobile'))
                      : !isCustomizationComplete
                        ? (disabledGenerateReasonMobile || t('customizeFirstTooltipMobile'))
                        : undefined
                  }
                  integrateInPopover={!isCustomizationComplete && hasVisitedClothingColorsIfEditable}
                >
                  {t('generatePhoto')}
                </GenerateButton>
              )}
            </CustomizationMobileFooter>
          </>
        ) : null}
      </div>
    </>
  )
}
