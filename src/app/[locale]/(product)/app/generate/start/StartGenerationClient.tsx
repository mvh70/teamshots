'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon } from '@heroicons/react/24/outline'
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
import GenerateButton from '@/components/generation/GenerateButton'
import { useAnalytics } from '@/hooks/useAnalytics'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import type { GenerationPageData, ContextOption } from './actions'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { MIN_SELFIES_REQUIRED, hasEnoughSelfies } from '@/constants/generation'
import { FlowProgressDock, CustomizationMobileFooter, StandardThreeStepIndicator } from '@/components/generation/navigation'
import type { CustomizationStepsMeta } from '@/lib/customizationSteps'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useOnboardingState } from '@/lib/onborda/hooks'
import Header from '@/app/[locale]/(product)/app/components/Header'
import {
  hasSavedBeautificationSettings,
  loadClothingColors,
  loadStyleSettings,
  saveClothingColors,
  saveStyleSettings,
} from '@/lib/clothing-colors-storage'
import { isUserChoice, hasValue, userChoice } from '@/domain/style/elements/base/element-types'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { useCustomizationCompletion } from '@/hooks/useCustomizationCompletion'
import { mergeSavedUserChoiceStyleSettings } from '@/lib/style-settings-merge'
import { usePersistedStringSet } from '@/hooks/usePersistedStringSet'
import { buildAllowedStyleRequestKeys } from '@/domain/style/style-setting-allowlists'
import { getAcceptedOnVisitKeysForPackage } from '@/domain/style/userChoice'
import { getChangedDesktopStepIndices, mergeVisitedStepIndices } from '@/lib/desktop-progress'
import { Toast } from '@/components/ui'
import { useDemographicsLoader } from '@/hooks/useDemographicsLoader'

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
  const skipUpload = useMemo(
    () => searchParams.get('skipUpload') === '1' || Boolean(keyFromQuery),
    [searchParams, keyFromQuery]
  )
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

  // Check for success state after checkout
  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')

  // Keep selected selfies in state so we can refresh stale prefetched server payloads.
  const [selectedSelfies, setSelectedSelfies] = useState(initialData.selectedSelfies)
  const selectedSelfieIdsCsv = useMemo(
    () => selectedSelfies.map((selfie) => selfie.id).join(','),
    [selectedSelfies]
  )
  const demographicsEndpoint = useMemo(() => {
    if (!selectedSelfieIdsCsv) return '/api/person/demographics'
    return `/api/person/demographics?selfieIds=${encodeURIComponent(selectedSelfieIdsCsv)}`
  }, [selectedSelfieIdsCsv])
  const { detectedGender } = useDemographicsLoader({
    endpoint: demographicsEndpoint,
    enabled: Boolean(skipUpload),
  })
  const ownedPackages = initialData.ownedPackages || []
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
    hasCompletedBeautification,
    hasSeenCustomizationIntro,
    hydrated,
    setCustomizationStepsMeta,
    customizationStepsMeta,
    visitedSteps,
    setVisitedSteps,
    completedSteps,
    setCompletedSteps,
    setCompletedBeautification
  } = useGenerationFlowState({ syncBeautificationFromSession: true })
  const isMobile = useMobileViewport()
  const { context: onboardingContext } = useOnboardingState()

  useEffect(() => {
    if (!hydrated || !skipUpload) return

    let cancelled = false

    const refreshSelectedSelfies = async () => {
      try {
        const response = await fetch(`/api/selfies/selected?t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) return

        const data = (await response.json()) as { selfies?: Array<{ id?: string; key?: string }> }
        if (cancelled || !Array.isArray(data.selfies)) return

        const nextSelectedSelfies = data.selfies
          .filter((selfie): selfie is { id: string; key: string } =>
            typeof selfie.id === 'string' && selfie.id.length > 0 &&
            typeof selfie.key === 'string' && selfie.key.length > 0
          )

        setSelectedSelfies((prev) => {
          if (prev.length === nextSelectedSelfies.length) {
            const prevIds = prev.map((selfie) => selfie.id).join(',')
            const nextIds = nextSelectedSelfies.map((selfie) => selfie.id).join(',')
            if (prevIds === nextIds) {
              return prev
            }
          }
          return nextSelectedSelfies
        })
      } catch {
        // Keep server-provided selection as fallback when refresh fails.
      }
    }

    void refreshSelectedSelfies()
    return () => {
      cancelled = true
    }
  }, [hydrated, skipUpload])

  const markGenerationFlow = useCallback(() => {
    setCompletedBeautification(false)
    markInFlow({ pending: true })
  }, [markInFlow, setCompletedBeautification])

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
  const [photoStyleSettings, setPhotoStyleSettingsRaw] = useState<PhotoStyleSettingsType>(initialData.styleData.photoStyleSettings)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(initialData.styleData.originalContextSettings)
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialData.styleData.selectedPackageId)
  // DEBUG: log initial data from server
  React.useEffect(() => {
    const s = initialData.styleData.photoStyleSettings
    console.log('[DEBUG mount]', {
      activeContextId: initialData.styleData.activeContext?.id,
      selectedPackageId: initialData.styleData.selectedPackageId,
      serverPose: s.pose?.value?.type, serverPoseMode: s.pose?.mode,
      serverTopLayer: s.clothingColors?.value?.topLayer, serverColorsMode: s.clothingColors?.mode,
      sessionHasData: typeof window !== 'undefined' && !!sessionStorage.getItem('teamshots_style_settings'),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [isGenerating, setIsGenerating] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const isGeneratingRef = React.useRef(false)
  const [visitedMobileSteps, setVisitedMobileSteps] = useState<Set<string>>(() => new Set())
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
          // User has enough selfies, continue with beautification step first
          router.push('/app/generate/beautification')
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
  const hadSavedStyleSettingsOnEntryRef = React.useRef(false)
  const hydratedRef = React.useRef(hydrated)
  hydratedRef.current = hydrated
  const prevStyleSettingsRef = React.useRef(photoStyleSettings)
  const latestPhotoStyleSettingsRef = React.useRef(photoStyleSettings)
  const prunedAcceptedVisitKeysRef = React.useRef(new Set<string>())

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
    const pkg = getPackageConfig(selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage)
    const saved = loadStyleSettings()
    return mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: pkg.visibleCategories,
    })
  }, [selectedPackageId])

  const persistStyleSettings = useCallback((settings: PhotoStyleSettingsType) => {
    saveStyleSettings(settings)

    const clothingColors = settings.clothingColors
    if (clothingColors && isUserChoice(clothingColors) && hasValue(clothingColors)) {
      saveClothingColors(clothingColors.value)
    }
  }, [])

  // Wrapper that persists every state change to sessionStorage (like invite dashboard).
  // Uses refs for guards so the callback identity is stable — no stale closures
  // when child components hold an older reference during App Router navigations.
  const setPhotoStyleSettings = useCallback((
    newSettings: PhotoStyleSettingsType | ((prev: PhotoStyleSettingsType) => PhotoStyleSettingsType)
  ) => {
    const current = latestPhotoStyleSettingsRef.current
    const updated = typeof newSettings === 'function' ? newSettings(current) : newSettings
    // Avoid re-saving unchanged snapshots. This prevents re-populating sessionStorage
    // immediately after users clear saved settings and re-enter this route.
    if (Object.is(updated, current)) {
      return
    }

    latestPhotoStyleSettingsRef.current = updated
    setPhotoStyleSettingsRaw(updated)

    if (hydratedRef.current && hasLoadedSavedSettingsRef.current) {
      persistStyleSettings(updated)
      // DEBUG: trace wrapper persist
      console.log('[DEBUG wrapper-persist]', {
        pose: updated.pose?.value?.type, poseMode: updated.pose?.mode,
        topLayer: updated.clothingColors?.value?.topLayer, colorsMode: updated.clothingColors?.mode,
      })
    }
  }, [persistStyleSettings])

  useEffect(() => {
    latestPhotoStyleSettingsRef.current = photoStyleSettings
  }, [photoStyleSettings])

  useEffect(() => {
    hadSavedStyleSettingsOnEntryRef.current = Boolean(loadStyleSettings())
  }, [])

  // Mark as ready for saving after hydration (regardless of skipUpload)
  // This ensures saves work in all flows
  useEffect(() => {
    if (!hydrated || hasLoadedSavedSettingsRef.current) {
      return
    }

    // Always merge saved settings once on hydration. This keeps behavior consistent
    // across entry paths (refresh, sidebar navigation, direct URL, onboarding redirects).
    setPhotoStyleSettings(prev => {
      let merged = mergeSavedStyleSettings(prev)
      merged = mergeSavedColors(merged)
      // DEBUG: trace hydration merge
      console.log('[DEBUG hydration-merge]', {
        skipUpload,
        activeContextId: activeContext?.id,
        prevPose: prev.pose?.value?.type, prevPoseMode: prev.pose?.mode,
        mergedPose: merged.pose?.value?.type, mergedPoseMode: merged.pose?.mode,
        prevTopLayer: prev.clothingColors?.value?.topLayer, prevColorsMode: prev.clothingColors?.mode,
        mergedTopLayer: merged.clothingColors?.value?.topLayer, mergedColorsMode: merged.clothingColors?.mode,
        sessionRaw: typeof window !== 'undefined' ? sessionStorage.getItem('teamshots_style_settings')?.substring(0, 300) : null,
      })
      return merged
    })

    // Mark as ready for saving (always, after hydration)
    hasLoadedSavedSettingsRef.current = true
  }, [hydrated, skipUpload, setPhotoStyleSettings, mergeSavedStyleSettings, mergeSavedColors, activeContext?.id])

  // Rehydrate from session whenever this route is (re)entered with skipUpload.
  // This handles App Router cache restores where component state can be stale
  // after navigating away (e.g., Selfies -> Generate -> Customize).
  useEffect(() => {
    if (!hydrated || !skipUpload) return

    setPhotoStyleSettings(prev => {
      let merged = mergeSavedStyleSettings(prev)
      merged = mergeSavedColors(merged)
      // DEBUG: trace re-entry merge
      console.log('[DEBUG re-entry-merge]', {
        prevPose: prev.pose?.value?.type, mergedPose: merged.pose?.value?.type,
        prevTopLayer: prev.clothingColors?.value?.topLayer, mergedTopLayer: merged.clothingColors?.value?.topLayer,
      })
      return merged
    })
  }, [hydrated, skipUpload, pathname, searchParamsString, setPhotoStyleSettings, mergeSavedStyleSettings, mergeSavedColors])

  const handleSettingsChange = useCallback((newSettings: PhotoStyleSettingsType | ((prev: PhotoStyleSettingsType) => PhotoStyleSettingsType)) => {
    setPhotoStyleSettings(newSettings)
  }, [setPhotoStyleSettings])

  useEffect(() => {
    if (!customizationStepsMeta?.stepKeys) {
      prevStyleSettingsRef.current = photoStyleSettings
      return
    }

    if (!isMobile) {
      const changedIndices = getChangedDesktopStepIndices(
        prevStyleSettingsRef.current as Record<string, unknown>,
        photoStyleSettings as Record<string, unknown>,
        customizationStepsMeta.stepKeys
      )

      if (changedIndices.length > 0) {
        setVisitedSteps((prevVisited) => mergeVisitedStepIndices(prevVisited, changedIndices))
      }
    }

    prevStyleSettingsRef.current = photoStyleSettings
  }, [photoStyleSettings, isMobile, customizationStepsMeta?.stepKeys, setVisitedSteps])

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
    // Free plan users always use personal credits
    if (isFreePlan) return 'personal'

    // Team admins/members/pro users use team credits
    if (isTeamAdmin || isTeamMember || isProUser) return 'team'

    // Fallback logic for other users
    return hasIndividualAccess ? 'personal' : (hasTeamAccess && hasTeamCredits ? 'team' : 'personal')
  }, [isFreePlan, isTeamAdmin, isTeamMember, isProUser, hasIndividualAccess, hasTeamAccess, hasTeamCredits])

  const handleMobileStepChange = useCallback((step: MobileStep | null) => {
    const stepId = step?.custom?.id ?? step?.category?.key ?? null
    if (!stepId) return

    if (stepId === 'branding') {
      handleSettingsChange((prev) => {
        const currentBranding = prev.branding
        if (!currentBranding || currentBranding.mode !== 'user-choice' || hasValue(currentBranding)) {
          return prev
        }
        return {
          ...prev,
          branding: userChoice({ type: 'exclude' }),
        }
      })
    }

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
  }, [handleSettingsChange])

  const handleCategoryVisit = useCallback((categoryKey: string) => {
    if (categoryKey === 'branding') {
      handleSettingsChange((prev) => {
        const currentBranding = prev.branding
        if (!currentBranding || currentBranding.mode !== 'user-choice' || hasValue(currentBranding)) {
          return prev
        }
        return {
          ...prev,
          branding: userChoice({ type: 'exclude' }),
        }
      })
    }

    setAcceptedVisitedStepKeys(prev => {
      if (prev.has(categoryKey)) return prev
      const next = new Set(prev)
      next.add(categoryKey)
      return next
    })
    if (!customizationStepsMeta?.stepKeys) return
    const index = customizationStepsMeta.stepKeys.indexOf(categoryKey)
    if (index < 0) return
    setVisitedSteps((prev) => (prev.includes(index) ? prev : [...prev, index]))
  }, [customizationStepsMeta?.stepKeys, handleSettingsChange, setVisitedSteps])
  const acceptedOnVisitKeys = React.useMemo(
    () =>
      getAcceptedOnVisitKeysForPackage(
        isFreePlan ? 'freepackage' : (selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage)
      ),
    [isFreePlan, selectedPackageId]
  )

  // Track whether we've received fresh step meta from PhotoStyleSettings this session
  // This prevents auto-proceed from using stale cached sessionStorage values
  const hasReceivedFreshMeta = React.useRef(false)

  const handleStepMetaChange = useCallback((meta: CustomizationStepsMeta) => {
    hasReceivedFreshMeta.current = true
    setCustomizationStepsMeta(meta)
  }, [setCustomizationStepsMeta])

  const handleBackToSelfies = useCallback(() => {
    // Navigate to the beautification step before selfie selection
    router.push('/app/generate/beautification')
  }, [router])

  const onProceed = useCallback(async () => {
    if (!hasEnoughSelfies(selectedSelfies.length) || !effectiveGenerationType) {
      console.error(`Missing required data for generation: need at least ${MIN_SELFIES_REQUIRED} selfies`)
      return
    }

    if (isGeneratingRef.current) return
    isGeneratingRef.current = true

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
      const allowedKeys = buildAllowedStyleRequestKeys(packageConfig.visibleCategories)
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

      router.push(redirectUrl)

    } catch (error) {
      console.error('Failed to start generation:', error)
      setToastMessage(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }, [
    selectedSelfies,
    effectiveGenerationType,
    session,
    track,
    activeContext,
    selectedPackageId,
    isFreePlan,
    subscriptionTier,
    photoStyleSettings,
    refetchCredits,
    router
  ])

  useEffect(() => {
    // Keep per-step acceptance persisted across route hops.
    // Clearing this on non-skipUpload entry caused pose/expression to appear
    // "not set" after navigating away and back.
    setVisitedMobileSteps(new Set())
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
  const {
    value: acceptedVisitedStepKeys,
    setValue: setAcceptedVisitedStepKeys,
    loaded: acceptedVisitedLoaded,
  } = usePersistedStringSet(acceptedVisitStorageKey)

  useEffect(() => {
    if (!hydrated || !acceptedVisitedLoaded) return
    if (prunedAcceptedVisitKeysRef.current.has(acceptedVisitStorageKey)) return

    prunedAcceptedVisitKeysRef.current.add(acceptedVisitStorageKey)

    // If there was no saved style snapshot when entering this page, stale accepted-step
    // markers should not make reset/default values appear as already chosen.
    if (hadSavedStyleSettingsOnEntryRef.current) return

    setAcceptedVisitedStepKeys((prev) => (prev.size === 0 ? prev : new Set()))
  }, [hydrated, acceptedVisitedLoaded, acceptedVisitStorageKey, setAcceptedVisitedStepKeys])

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
  // Completion should always derive from value comparison logic.
  // The hook already falls back to package defaults when originalContextSettings is missing.
  const hasUneditedFields = completionState.hasUneditedFields
  const isCustomizationComplete = completionState.isCustomizationComplete
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

  const canGenerate =
    hasEnoughCredits &&
    hasRequiredSelfies &&
    isCustomizationComplete &&
    hasVisitedClothingColorsIfEditable

  // NEW CREDIT MODEL: All usable credits are on person
  const hasAnyCredits = userCredits.person > 0
  const pagePaddingClasses = skipUpload ? 'px-0 md:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'
  const styleSourceValue =
    activeContext?.id || (ownedPackages.length > 1 ? `package_${selectedPackageId}` : 'freestyle')

  const handleStyleSourceChange = useCallback(async (value: string) => {
    if (value === 'freestyle') {
      if (activeContext?.id) {
        clearActiveStyle({ styleId: activeContext.id }).catch(() => { })
      }
      setActiveContext(null)
      const fallbackPackage = getPackageConfig(fallbackPackageId)
      setSelectedPackageId(fallbackPackageId)
      try { localStorage.setItem(SELECTED_PACKAGE_KEY, fallbackPackageId) } catch { }
      let newSettings = mergeSavedStyleSettings(fallbackPackage.defaultSettings)
      newSettings = mergeSavedColors(newSettings)
      setPhotoStyleSettings(newSettings)
      setOriginalContextSettings(fallbackPackage.defaultSettings)
      return
    }

    if (value.startsWith('package_')) {
      const pkgId = value.replace('package_', '')
      if (activeContext?.id) {
        clearActiveStyle({ styleId: activeContext.id }).catch(() => { })
      }
      setActiveContext(null)
      setSelectedPackageId(pkgId)
      try { localStorage.setItem(SELECTED_PACKAGE_KEY, pkgId) } catch { }
      const pkg = getPackageConfig(pkgId)
      let newSettings = mergeSavedStyleSettings(pkg.defaultSettings)
      newSettings = mergeSavedColors(newSettings)
      setPhotoStyleSettings(newSettings)
      setOriginalContextSettings(pkg.defaultSettings)
      return
    }

    const selectedContext = availableContexts.find(ctx => ctx.id === value)
    if (!selectedContext) return

    try { localStorage.removeItem(SELECTED_PACKAGE_KEY) } catch { }
    setActiveStyle({ styleId: selectedContext.id }).catch(() => {
      // Silently ignore persistence errors for session-only usage.
    })
    const { ui, pkg, context } = await loadStyleByContextId(selectedContext.id)
    const contextIndex = availableContexts.findIndex((ctx) => ctx.id === selectedContext.id)
    const updatedName = normalizeContextName(
      context?.name ?? selectedContext.name,
      contextIndex === -1 ? availableContexts.length : contextIndex,
      availableContexts.length || 1,
      effectiveGenerationType
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
    const newSettings = ui.clothingColors && isUserChoice(ui.clothingColors)
      ? mergeSavedColors(ui)
      : ui
    setPhotoStyleSettings(newSettings)
    setSelectedPackageId(pkg.id)
    setOriginalContextSettings(ui)
  }, [
    activeContext?.id,
    setPhotoStyleSettings,
    availableContexts,
    clearActiveStyle,
    effectiveGenerationType,
    fallbackPackageId,
    loadStyleByContextId,
    mergeSavedColors,
    mergeSavedStyleSettings,
    normalizeContextName,
    SELECTED_PACKAGE_KEY,
    setActiveStyle,
  ])

  const renderStyleSourceOptions = () => (
    <>
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
    </>
  )

  // Redirect to intro page if not seen yet (route-based intros)
  useEffect(() => {
    if (!hydrated || !skipUpload) {
      return
    }

    if (!hasCompletedBeautification) {
      // Avoid redirect loops when the completed flag hasn't synced yet but
      // beautification is already persisted in session style settings.
      if (hasSavedBeautificationSettings()) {
        setCompletedBeautification(true)
        return
      }

      router.replace('/app/generate/beautification')
      return
    }

    if (!hasSeenCustomizationIntro) {
      router.replace('/app/generate/customization-intro')
    }
  }, [
    hydrated,
    skipUpload,
    hasCompletedBeautification,
    hasSeenCustomizationIntro,
    router,
    setCompletedBeautification,
  ])

  if (isSuccess && (successType === 'individual_success' || successType === 'vip_success' || successType === 'seats_success')) {
    return <PurchaseSuccess />
  }

  if (!creditsLoading && !hasAnyCredits) {
    return (
      <div className={`${pagePaddingClasses} space-y-6`}>
        <div data-testid="no-credits-card" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className="px-6 py-3 rounded-md text-white font-medium transition-colors hover:brightness-110 active:brightness-95"
                style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
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
  if (!hydrated || (skipUpload && (!hasCompletedBeautification || !hasSeenCustomizationIntro))) {
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
    visitedStepKeys: acceptedVisitedStepKeys,
    detectedGender,
    uneditedFields,
    onGenerateAction: onProceed,
  }

  return (
    <>
      {toastMessage ? (
        <Toast
          message={toastMessage}
          type="error"
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
      {/* Progress Dock - Bottom Center (Desktop Only) */}
      {!isMobile && (
        <FlowProgressDock
          selfieCount={selectedSelfies.length}
          hasUneditedFields={!isCustomizationComplete}
          hasEnoughCredits={hasEnoughCredits}
          currentStep="customize"
          onNavigateToPreviousStep={handleBackToSelfies}
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
      )}

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
        ) : skipUpload ? (
          <>
            {/* Alert for insufficient credits - shown inline if needed */}
            {!hasEnoughCredits && (
              <div data-testid="desktop-insufficient-credits-alert" className="hidden md:block mb-6">
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

            {/* Desktop Page Header - matches intro pages typography */}
            <div className="hidden md:block pt-8 md:pt-10 space-y-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.1] font-serif tracking-tight">
                {tCustomize('title')}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed max-w-3xl">
                {tCustomize('subtitle')}
              </p>
            </div>

            {/* Mobile: explicit style-source selector parity with desktop */}
            {!isFreePlan && (effectiveGenerationType === 'personal' || effectiveGenerationType === 'team') && (
              <div className="md:hidden rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/40 to-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  {effectiveGenerationType === 'personal' ? t('selectPhotoStyle') : 'Photo Style'}
                </label>
                <div className="relative">
                  <select
                    value={styleSourceValue}
                    onChange={(e) => {
                      void handleStyleSourceChange(e.target.value)
                    }}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {renderStyleSourceOptions()}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

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
                      value={styleSourceValue}
                      onChange={(e) => {
                        void handleStyleSourceChange(e.target.value)
                      }}
                      className="w-full appearance-none px-5 py-3.5 pr-12 text-sm font-medium text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all cursor-pointer"
                    >
                      {renderStyleSourceOptions()}
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
                label: (stepIndicatorProps?.currentAllStepsIndex ?? 0) <= 2
                  ? tNav('beautification', { default: 'Beautification' })
                  : tNav('previous', { default: 'Previous' }),
                onClick: () => {
                  if ((stepIndicatorProps?.currentAllStepsIndex ?? 0) <= 2) {
                    router.push('/app/generate/beautification')
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
                <StandardThreeStepIndicator
                  className="pb-3"
                  currentIndex={stepIndicatorProps?.currentAllStepsIndex ?? 2}
                  totalSteps={
                    stepIndicatorProps?.totalWithLocked ??
                    stepIndicatorProps?.total ??
                    Math.max(customizationStepsMeta.allSteps + 2, 3)
                  }
                  visitedSteps={
                    stepIndicatorProps?.visitedEditableSteps ??
                    [
                      ...(hasRequiredSelfies ? [0] : []),
                      ...(hasCompletedBeautification ? [1] : []),
                      ...visitedSteps.map((idx) => idx + 2),
                    ]
                  }
                  lockedSteps={
                    stepIndicatorProps?.lockedSteps ??
                    customizationStepsMeta.lockedSteps.map((idx) => idx + 2)
                  }
                />
              }
            >
              {!hasEnoughCredits ? (
                <Link
                  href={buyCreditsHrefWithReturn}
                  className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 hover:brightness-110 active:brightness-95"
                  style={{
                    background: `linear-gradient(to right, ${BRAND_CONFIG.colors.cta}, ${BRAND_CONFIG.colors.ctaHover})`
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
