'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import dynamic from 'next/dynamic'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import type { MobileStep } from '@/components/customization/PhotoStyleSettings'
import GenerateButton from '@/components/generation/GenerateButton'
import { useUploadSelfieEndpoints } from '@/hooks/useUploadSelfieEndpoints'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { DEFAULT_PHOTO_STYLE_SETTINGS, PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { getPackageConfig } from '@/domain/style/packages'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { SwipeableContainer, FlowProgressDock, CustomizationMobileFooter, StandardThreeStepIndicator } from '@/components/generation/navigation'
import { trackInvitedMemberGenerationStarted } from '@/lib/track'
import { DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { useCustomizationCompletion } from '@/hooks/useCustomizationCompletion'
import { loadStyleSettings, saveStyleSettings } from '@/lib/clothing-colors-storage'
import { mergeSavedUserChoiceStyleSettings } from '@/lib/style-settings-merge'
import { getChangedDesktopStepIndices, mergeVisitedStepIndices } from '@/lib/desktop-progress'
import { usePersistedStringSet } from '@/hooks/usePersistedStringSet'
import { buildAllowedStyleRequestKeys } from '@/domain/style/style-setting-allowlists'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import { useInviteStats } from '@/hooks/useInviteStats'
import { isRecord } from '@/lib/type-guards'
import { Toast } from '@/components/ui'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import { parseInviteSelfiesResponse } from '@/lib/inviteSelfies'
import { getAcceptedOnVisitKeysForPackage } from '@/domain/style/userChoice'
import type { InviteDashboardStats } from '@/types/invite'
import { useDemographicsLoader } from '@/hooks/useDemographicsLoader'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface Selfie {
  id: string
  key: string
  used?: boolean
}

/**
 * Customization page for invited users.
 *
 * Flow: /invite-dashboard/[token]/customization-intro → /invite-dashboard/[token]/customization → /invite-dashboard/[token]/generations
 *
 * This page handles photo style customization and generation for invited team members.
 * On mobile: Swipeable cards with step-by-step progression
 * On desktop: Card layout with all options visible
 */
export default function InviteCustomizationPage() {
  const params = useParams()
  const t = useTranslations('inviteDashboard')
  const token = params.token as string
  const navigation = useInviteFlowNavigation(token)

  const { stats, refreshStats: refreshInviteStats } = useInviteStats<InviteDashboardStats>(token, {
    initialStats: {
      photosGenerated: 0,
      creditsRemaining: 0,
      selfiesUploaded: 0,
      teamPhotosGenerated: 0,
    },
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvedContextId, setResolvedContextId] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [availableSelfies, setAvailableSelfies] = useState<Selfie[]>([])
  const [activeMobileStepInfo, setActiveMobileStepInfo] = useState<{ type: MobileStep['type'] | null, id: string | null, index: number }>({
    type: null,
    id: null,
    index: 0
  })
  // Navigation methods exposed by PhotoStyleSettings
  const [navMethods, setNavMethods] = useState<{ goNext: () => void; goPrev: () => void; goToStep: (index: number) => void } | null>(null)
  // Step indicator props exposed by PhotoStyleSettings for sticky footer navigation
  const [stepIndicatorProps, setStepIndicatorProps] = useState<{ current: number; total: number; lockedSteps?: number[]; totalWithLocked?: number; currentAllStepsIndex?: number; visitedEditableSteps?: number[] } | undefined>(undefined)
  const isMobileViewport = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()

  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useUploadSelfieEndpoints(token, 'invite')
  // Intentionally keep direct `useGenerationFlowState` usage here.
  // This page receives authoritative step metadata from `StyleSettingsSection`
  // and avoids the extra invite-meta synchronization side effects.
  const {
    clearFlow,
    hydrated,
    setCustomizationStepsMeta,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps: persistedVisitedIndices,
    setVisitedSteps: setPersistedVisitedSteps
  } = useGenerationFlowState({
    syncBeautificationFromSession: true,
    beautificationScope: `invite_${token}`,
    flowScope: token,
  })

  // Multi-select: load and manage selected selfies for invited flow
  const { selectedIds, loadSelected, toggleSelect } = useSelfieSelection({ token })

  // Photo style settings
  const [photoStyleSettings, setPhotoStyleSettingsRaw] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const latestPhotoStyleSettingsRef = useRef(photoStyleSettings)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [packageId, setPackageId] = useState<string>('headshot1')
  const acceptedVisitStorageKey = useMemo(
    () => `teamshots_invite_accepted_visited_steps_${token}`,
    [token]
  )
  const styleSettingsStorageScope = useMemo(() => `invite_${token}`, [token])
  const {
    value: acceptedVisitedStepKeys,
    setValue: setAcceptedVisitedStepKeys,
  } = usePersistedStringSet(acceptedVisitStorageKey)

  const mergeSavedStyleSettings = useCallback((settings: PhotoStyleSettingsType): PhotoStyleSettingsType => {
    const pkg = getPackageConfig(packageId || 'headshot1')
    return mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: loadStyleSettings(styleSettingsStorageScope),
      visibleCategories: pkg.visibleCategories,
    })
  }, [styleSettingsStorageScope, packageId])

  useEffect(() => {
    latestPhotoStyleSettingsRef.current = photoStyleSettings
  }, [photoStyleSettings])

  // Wrapper for setPhotoStyleSettings that also marks steps as visited on desktop
  // and persists immediately to avoid losing quick changes on navigation.
  const setPhotoStyleSettings = useCallback((newSettings: PhotoStyleSettingsType | ((prev: PhotoStyleSettingsType) => PhotoStyleSettingsType)) => {
    const current = latestPhotoStyleSettingsRef.current
    const updated = typeof newSettings === 'function' ? newSettings(current) : newSettings

    latestPhotoStyleSettingsRef.current = updated
    setPhotoStyleSettingsRaw(updated)

    if (!isMobileViewport && customizationStepsMeta.stepKeys) {
      const changedIndices = getChangedDesktopStepIndices(
        current as Record<string, unknown>,
        updated as Record<string, unknown>,
        customizationStepsMeta.stepKeys
      )

      if (changedIndices.length > 0) {
        setTimeout(() => {
          setPersistedVisitedSteps((prevVisited) =>
            mergeVisitedStepIndices(prevVisited, changedIndices)
          )
        }, 0)
      }
    }

    if (hydrated && originalContextSettings) {
      saveStyleSettings(updated, styleSettingsStorageScope)
    }
  }, [
    customizationStepsMeta.stepKeys,
    hydrated,
    isMobileViewport,
    originalContextSettings,
    setPersistedVisitedSteps,
    styleSettingsStorageScope,
  ])

  const loadContextSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/context?token=${encodeURIComponent(token)}`)

      if (!response.ok) {
        throw new Error('Failed to fetch context')
      }

      const data = await response.json()
      if (
        !isRecord(data) ||
        (data.context && !isRecord(data.context))
      ) {
        throw new Error('Invalid context payload')
      }

      if (!data.context) {
        throw new Error('No context found')
      }

      const contextData = data.context as { id: string; settings?: Record<string, unknown> }
      setResolvedContextId(contextData.id)

      const { extractPackageId } = await import('@/domain/style/settings-resolver')
      const extractedPackageId = (data.packageId as string | undefined) || extractPackageId(contextData.settings ?? {}) || 'headshot1'

      const pkg = getPackageConfig(extractedPackageId)
      const deserializedSettings = contextData.settings
        ? pkg.persistenceAdapter.deserialize(contextData.settings)
        : pkg.defaultSettings

      setPhotoStyleSettings(mergeSavedStyleSettings(deserializedSettings))
      setOriginalContextSettings(deserializedSettings)
      setPackageId(pkg.id)
    } catch (error) {
      console.error('Error loading context settings:', error)
      setResolvedContextId(undefined)
      const headshot1Pkg = getPackageConfig('headshot1')
      const fallbackSettings = headshot1Pkg.defaultSettings
      setPhotoStyleSettings(mergeSavedStyleSettings(fallbackSettings))
      setOriginalContextSettings(fallbackSettings)
      setPackageId('headshot1')
    }
  }, [token, mergeSavedStyleSettings, setPhotoStyleSettings])

  const fetchAvailableSelfies = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/selfies?token=${token}&t=${Date.now()}`,
        { credentials: 'include', cache: 'no-store' as RequestCache }
      )
      if (response.ok) {
        const data = await response.json()
        const selfies = parseInviteSelfiesResponse(data)
        setAvailableSelfies(selfies)
      }
    } catch (error) {
      console.error('Error fetching selfies:', error)
    }
  }, [token])

  const selectUploadedSelfie = useCallback(async (key: string, selfieId?: string) => {
    try {
      if (selfieId) {
        await toggleSelect(selfieId, true)
      } else {
        const updatedResponse = await fetch(`/api/team/member/selfies?token=${token}&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store' as RequestCache,
        })
        if (!updatedResponse.ok) {
          throw new Error('Failed to refresh selfies')
        }
        const updatedData = await updatedResponse.json()
        const updatedSelfies = parseInviteSelfiesResponse(updatedData)
        const newSelfie = updatedSelfies.find((s) => s.key === key)
        if (newSelfie) {
          await toggleSelect(newSelfie.id, true)
        }
      }
    } catch (error) {
      console.error('Error selecting newly uploaded selfie:', error)
    }
  }, [toggleSelect, token])

  const handleMobileUploadApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    await Promise.all(results.map(({ key, selfieId }) => selectUploadedSelfie(key, selfieId)))
    await Promise.all([loadSelected(), fetchAvailableSelfies()])
  }, [selectUploadedSelfie, loadSelected, fetchAvailableSelfies])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const initialize = async () => {
      setLoading(true)
      await Promise.all([
        loadContextSettings(),
        refreshInviteStats(),
      ])

      if (!cancelled) {
        setLoading(false)
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [token, loadContextSettings, refreshInviteStats])

  // Fetch selfies and selections on mount
  useEffect(() => {
    fetchAvailableSelfies()
  }, [fetchAvailableSelfies])

  // Filter selectedIds to only include selfies that actually exist
  const validSelectedIds = useMemo(() =>
    selectedIds.filter(id => availableSelfies.some(s => s.id === id)),
    [selectedIds, availableSelfies]
  )
  const selectedSelfieIdsCsv = useMemo(
    () => validSelectedIds.join(','),
    [validSelectedIds]
  )
  const demographicsEndpoint = useMemo(() => {
    const base = `/api/team/member/demographics?token=${encodeURIComponent(token)}`
    if (!selectedSelfieIdsCsv) return base
    return `${base}&selfieIds=${encodeURIComponent(selectedSelfieIdsCsv)}`
  }, [token, selectedSelfieIdsCsv])
  const { detectedGender } = useDemographicsLoader({
    endpoint: demographicsEndpoint,
    enabled: Boolean(token),
  })
  const visitedStepKeys = useMemo(() => {
    const visited = new Set<string>(acceptedVisitedStepKeys)
    const mappedKeys = (customizationStepsMeta.stepKeys ?? [])
      .flatMap((stepKey, index) => (persistedVisitedIndices.includes(index) ? [stepKey] : []))
    mappedKeys.forEach((key) => visited.add(key))
    return visited
  }, [acceptedVisitedStepKeys, customizationStepsMeta.stepKeys, persistedVisitedIndices])
  const acceptedOnVisitKeys = useMemo(
    () => getAcceptedOnVisitKeysForPackage(packageId || 'headshot1'),
    [packageId]
  )

  const {
    uneditedFields,
    isCustomizationComplete,
    isClothingColorsEditable,
    hasVisitedClothingColorsIfEditable: hasVisitedClothingColors
  } = useCustomizationCompletion({
    photoStyleSettings,
    originalContextSettings,
    packageId: packageId || 'headshot1',
    stepKeys: customizationStepsMeta.stepKeys,
    editableSteps: customizationStepsMeta.editableSteps,
    visitedStepKeys,
    visitedMobileStepKeys: visitedStepKeys,
    isMobileViewport,
    completionMode: 'values-or-visited',
    includeDefaultValues: false,
    clothingColorsEditableWhenMissing: false,
    acceptedOnVisitKeys: acceptedOnVisitKeys,
    acceptedOnVisitVisitedKeys: acceptedVisitedStepKeys
  })

  const canGenerate = validSelectedIds.length >= 2 &&
                      stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration &&
                      isCustomizationComplete &&
                      hasVisitedClothingColors

  // Build disabled reason for generate button tooltip
  const disabledReason = useMemo(() => {
    if (canGenerate) return undefined

    const reasons: string[] = []

    if (validSelectedIds.length < 2) {
      reasons.push(t('styleSelection.disabledReasons.needSelfies', {
        required: 2,
        current: validSelectedIds.length
      }))
    }

    if (stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration) {
      reasons.push(t('styleSelection.disabledReasons.needCredits', {
        required: PRICING_CONFIG.credits.perGeneration,
        current: stats.creditsRemaining
      }))
    }

    if (!isCustomizationComplete) {
      const stepsVisited = visitedStepKeys.size
      const stepsRequired = customizationStepsMeta.editableSteps
      reasons.push(t('styleSelection.disabledReasons.needCustomization', {
        visited: stepsVisited,
        total: stepsRequired
      }))
    }

    if (!hasVisitedClothingColors && isMobileViewport && isClothingColorsEditable) {
      reasons.push(t('styleSelection.disabledReasons.needClothingColors'))
    }

    return reasons.length > 0 ? reasons.join('. ') : undefined
  }, [canGenerate, validSelectedIds.length, stats.creditsRemaining, isCustomizationComplete, hasVisitedClothingColors, isMobileViewport, isClothingColorsEditable, visitedStepKeys.size, customizationStepsMeta.editableSteps, t])

  const markStepVisitedByKey = useCallback((stepKey: string) => {
    const stepIndex = customizationStepsMeta.stepKeys?.indexOf(stepKey) ?? -1
    if (stepIndex < 0) return
    setPersistedVisitedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]))
  }, [customizationStepsMeta.stepKeys, setPersistedVisitedSteps])

  const handleMobileStepChange = useCallback((step: MobileStep | null, stepIndex?: number) => {
    const stepId = step?.custom?.id ?? step?.category?.key ?? null
    setActiveMobileStepInfo({
      type: step?.type ?? null,
      id: stepId,
      index: stepIndex ?? 0
    })
    if (stepId) {
      markStepVisitedByKey(stepId)
      setAcceptedVisitedStepKeys(prev => {
        if (prev.has(stepId)) return prev
        const next = new Set(prev)
        next.add(stepId)
        return next
      })
    }
  }, [markStepVisitedByKey, setAcceptedVisitedStepKeys])

  const handleCategoryVisit = useCallback((categoryKey: string) => {
    setAcceptedVisitedStepKeys(prev => {
      if (prev.has(categoryKey)) return prev
      const next = new Set(prev)
      next.add(categoryKey)
      return next
    })
    markStepVisitedByKey(categoryKey)
  }, [markStepVisitedByKey, setAcceptedVisitedStepKeys])

  // Navigation helper: go back to customization intro
  const handleBack = useCallback(() => {
    navigation.toCustomizationIntro()
  }, [navigation])

  // Navigation helper: go back to dashboard
  const goBackToDashboard = useCallback(() => {
    clearFlow()
    navigation.replaceDashboard()
  }, [clearFlow, navigation])

  // Navigation handlers for FlowProgressDock
  const handleNavigateToBeautification = useCallback(() => {
    navigation.toBeautification()
  }, [navigation])

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (validSelectedIds.length < 2) {
      setToastMessage(t('alerts.selectAtLeastTwoSelfies'))
      return
    }

    // Validate all customizable sections are customized
    if (!isCustomizationComplete) {
      setToastMessage(t('alerts.customizePhoto', { default: 'Please customize your photo settings before generating' }))
      return
    }

    // Check if user has enough credits
    if (stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration) {
      const creditMessage = stats.adminName
        ? t('alerts.insufficientCreditsWithName', {
            adminName: stats.adminName,
            adminEmail: stats.adminEmail || t('insufficientCredits.yourTeamAdmin')
          })
        : stats.adminEmail
        ? t('alerts.insufficientCreditsWithEmail', { adminEmail: stats.adminEmail })
        : t('alerts.insufficientCreditsGeneric')
      setToastMessage(creditMessage)
      return
    }

    // Prevent double-clicks
    if (isGenerating) return

    try {
      setIsGenerating(true)

      const effectivePackageId = packageId || 'headshot1'
      const packageConfig = getPackageConfig(effectivePackageId)
      const allowedKeys = buildAllowedStyleRequestKeys(packageConfig.visibleCategories)
      const filteredStyleSettings = Object.fromEntries(
        Object.entries({ ...photoStyleSettings, packageId: effectivePackageId })
          .filter(([key]) => allowedKeys.has(key))
      )

      const requestBody: Record<string, unknown> = {
        contextId: resolvedContextId,
        styleSettings: filteredStyleSettings,
        prompt: 'Professional headshot',
        selfieIds: validSelectedIds,
        debugMode: process.env.NODE_ENV !== 'production'
      }

      const response = await fetch(`/api/team/member/generations/create?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        trackInvitedMemberGenerationStarted({
          team_name: stats.teamName,
          selfie_count: validSelectedIds.length
        })

        setIsGenerating(false)
        clearFlow()
        navigation.toGenerations()
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Generation failed:', error)
        setToastMessage(error.message || error.error || t('alerts.generationFailed'))
        setIsGenerating(false)
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      setToastMessage(t('alerts.generationFailed'))
      setIsGenerating(false)
    }
  }

  // Show skeleton while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Form skeleton */}
        <div className="px-4 py-6 space-y-4">
          <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse" />
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse mt-6" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <FlowPageSkeleton variant="centered-spinner" loadingLabel={t('loading')} />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('error.invalidInvite')}</h1>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={navigation.toDashboard}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              {t('error.goToHomepage')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const photosAffordable = calculatePhotosFromCredits(stats.creditsRemaining)

  // Create the header component for reuse
  const inviteHeader = (
    <InviteDashboardHeader
      token={token}
      teamName={stats.teamName || 'Team'}
      creditsRemaining={stats.creditsRemaining}
      photosAffordable={photosAffordable}
      showBackToDashboard
      onBackClick={goBackToDashboard}
      hideTitle
    />
  )

  const sharedStyleSettingsSectionProps = {
    value: photoStyleSettings,
    onChange: setPhotoStyleSettings,
    readonlyPredefined: true,
    originalContextSettings,
    showToggles: false as const,
    packageId: packageId || 'headshot1',
    noContainer: true,
    teamContext: true,
    token,
    onStepMetaChange: setCustomizationStepsMeta,
    enableDesktopProgressiveActivation: true,
    onCategoryVisit: handleCategoryVisit,
    acceptedOnVisitKeys: acceptedOnVisitKeys,
    visitedStepKeys: acceptedVisitedStepKeys,
    detectedGender,
    uneditedFields,
  }

  const currentDockStepIndex = stepIndicatorProps?.currentAllStepsIndex ?? 0
  const totalDockSteps = stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1
  const isLastDockStep = stepIndicatorProps
    ? currentDockStepIndex >= totalDockSteps - 1
    : false
  const isInlineHintStep =
    activeMobileStepInfo.type === 'selfie-tips' || activeMobileStepInfo.type === 'intro'
  const isSelfieUploadStep = activeMobileStepInfo.type === 'custom' && activeMobileStepInfo.id === 'selfie-step'
  const showGenerateInBody = !isInlineHintStep && !isSelfieUploadStep && isLastDockStep
  const canGoNextStep = Boolean(navMethods) && !isLastDockStep

  return (
    <div className="min-h-screen bg-gray-50">
      {toastMessage ? (
        <Toast
          message={toastMessage}
          type="error"
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
      {/* Header - hidden on mobile (handled by StyleSettingsSection) */}
      <div className="hidden md:block">
        {inviteHeader}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-0 sm:px-6 lg:px-8 md:py-8">
        <SwipeableContainer
          onSwipeRight={isSwipeEnabled && activeMobileStepInfo.index === 0 ? handleBack : undefined}
          onSwipeLeft={undefined}
          enabled={isSwipeEnabled && activeMobileStepInfo.index === 0}
        >
          <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6 pb-44 md:pb-52">
            {isMobileViewport ? (
              <div className="space-y-6">
                <StyleSettingsSection
                  {...sharedStyleSettingsSectionProps}
                  onMobileStepChange={handleMobileStepChange}
                  onSwipeBack={handleBack}
                  topHeader={inviteHeader}
                  onNavigationReady={setNavMethods}
                  hideInlineNavigation={true}
                  onStepIndicatorChange={setStepIndicatorProps}
                />
              </div>
            ) : (
              <StyleSettingsSection
                {...sharedStyleSettingsSectionProps}
              />
            )}

            <CustomizationMobileFooter
              leftAction={{
                label: currentDockStepIndex <= 2
                  ? t('selfieSelection.mobile.navigation.back', { default: 'Back' })
                  : t('selfieSelection.mobile.navigation.back', { default: 'Back' }),
                onClick: () => {
                  if (currentDockStepIndex <= 2) {
                    handleBack()
                    return
                  }
                  navMethods?.goPrev()
                }
              }}
              rightAction={showGenerateInBody
                ? undefined
                : {
                    label: t('selfieSelection.mobile.navigation.next', { default: 'Next' }),
                    onClick: () => navMethods?.goNext(),
                    disabled: !canGoNextStep,
                    tone: 'primary',
                    icon: 'chevron-right'
                  }}
              progressContent={
                <StandardThreeStepIndicator
                  className="pb-3"
                  currentIndex={stepIndicatorProps?.currentAllStepsIndex ?? 0}
                  totalSteps={stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1}
                  visitedSteps={stepIndicatorProps?.visitedEditableSteps}
                  lockedSteps={stepIndicatorProps?.lockedSteps}
                />
              }
            >
              {activeMobileStepInfo.type === 'selfie-tips' ? (
                /* Selfie tips step: Show swipe hint to continue */
                <div className="flex items-center justify-center gap-3 py-3 px-4 bg-brand-primary/10 rounded-xl overflow-hidden">
                  <span className="text-sm font-medium text-brand-primary">
                    {t('mobile.selfieTips.swipeHint', { default: 'Swipe left to select your selfies' })}
                  </span>
                  <div
                    className="flex items-center"
                    style={{
                      animation: 'slideRight 1.2s ease-in-out infinite'
                    }}
                  >
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-5 h-5 -ml-3 text-brand-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ) : activeMobileStepInfo.type === 'intro' ? (
                /* Intro step: Show swipe hint banner instead of generate button */
                <div className="flex items-center justify-center gap-3 py-3 px-4 bg-brand-primary/10 rounded-xl overflow-hidden">
                  <span className="text-sm font-medium text-brand-primary">
                    {t('mobile.intro.swipeHint', { default: 'Swipe left to start customizing' })}
                  </span>
                  <div
                    className="flex items-center"
                    style={{
                      animation: 'slideRight 1.2s ease-in-out infinite'
                    }}
                  >
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-5 h-5 -ml-3 text-brand-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ) : activeMobileStepInfo.type === 'custom' && activeMobileStepInfo.id === 'selfie-step' ? (
                <div className="pb-2">
                  <SelfieUploadFlow
                    hideHeader
                    uploadEndpoint={inviteUploadEndpoint}
                    saveEndpoint={inviteSaveEndpoint}
                    onSelfiesApproved={handleMobileUploadApproved}
                    onCancel={() => undefined}
                    onError={(message) => {
                      setToastMessage(message || t('alerts.uploadFailed'))
                    }}
                  />
                </div>
              ) : showGenerateInBody ? (
                <GenerateButton
                  onClick={onProceed}
                  disabled={!canGenerate}
                  isGenerating={isGenerating}
                  size="md"
                  disabledReason={disabledReason}
                >
                  {t('styleSelection.generateButton')}
                </GenerateButton>
              ) : null}
            </CustomizationMobileFooter>

          </div>
        </SwipeableContainer>
      </div>

      {/* Desktop: FlowProgressDock */}
      {!isMobileViewport && (
        <FlowProgressDock
          selfieCount={validSelectedIds.length}
          hasUneditedFields={!isCustomizationComplete}
          hasEnoughCredits={stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration}
          currentStep="customize"
          onNavigateToPreviousStep={handleNavigateToBeautification}
          onNavigateToCustomize={() => undefined}
          onGenerate={onProceed}
          isGenerating={isGenerating}
          onNavigateToDashboard={navigation.toDashboard}
          customizationStepsMeta={customizationStepsMeta}
          visitedEditableSteps={
            // When customization is complete (all values changed), mark all steps as visited
            isCustomizationComplete && customizationStepsMeta.editableSteps > 0
              ? Array.from({ length: customizationStepsMeta.editableSteps }, (_, i) => i)
              : persistedVisitedIndices.filter((idx) => idx >= 0)
          }
        />
      )}
    </div>
  )
}
