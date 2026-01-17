'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import type { MobileStep } from '@/components/customization/PhotoStyleSettings'
import GenerateButton from '@/components/generation/GenerateButton'
import { useInviteSelfieEndpoints } from '@/hooks/useInviteSelfieEndpoints'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { hasUneditedEditableFields } from '@/domain/style/userChoice'
import { DEFAULT_PHOTO_STYLE_SETTINGS, PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { getPackageConfig } from '@/domain/style/packages'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { SwipeableContainer, FlowProgressDock, FlowNavigation } from '@/components/generation/navigation'
import { trackInvitedMemberGenerationStarted } from '@/lib/track'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import { DEFAULT_CUSTOMIZATION_STEPS_META, buildSelfieStepIndicator } from '@/lib/customizationSteps'

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface InviteData {
  email: string
  teamName: string
  creditsAllocated: number
  expiresAt: string
  hasActiveContext: boolean
  personId: string
  firstName: string
  lastName?: string
  contextId?: string
}

interface DashboardStats {
  photosGenerated: number
  creditsRemaining: number
  selfiesUploaded: number
  teamPhotosGenerated: number
  adminName?: string | null
  adminEmail?: string | null
}

interface Selfie {
  id: string
  key: string
  url: string
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
  const router = useRouter()
  const t = useTranslations('inviteDashboard')
  const token = params.token as string

  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    photosGenerated: 0,
    creditsRemaining: 0,
    selfiesUploaded: 0,
    teamPhotosGenerated: 0
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const [availableSelfies, setAvailableSelfies] = useState<Selfie[]>([])
  const [activeMobileStepInfo, setActiveMobileStepInfo] = useState<{ type: MobileStep['type'] | null, id: string | null, index: number }>({
    type: null,
    id: null,
    index: 0
  })
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set())
  // Navigation methods exposed by PhotoStyleSettings
  const [navMethods, setNavMethods] = useState<{ goNext: () => void; goPrev: () => void; goToStep: (index: number) => void } | null>(null)
  // Step indicator props exposed by PhotoStyleSettings for sticky footer navigation
  const [stepIndicatorProps, setStepIndicatorProps] = useState<{ current: number; total: number; lockedSteps?: number[]; totalWithLocked?: number; currentAllStepsIndex?: number; visitedEditableSteps?: number[] } | undefined>(undefined)
  const isMobileViewport = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()

  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useInviteSelfieEndpoints(token)
  const {
    clearFlow,
    hydrated,
    setCustomizationStepsMeta,
    customizationStepsMeta = DEFAULT_CUSTOMIZATION_STEPS_META,
    visitedSteps: persistedVisitedIndices
  } = useGenerationFlowState()

  // Multi-select: load and manage selected selfies for invited flow
  const { selectedSet, selectedIds, loadSelected, toggleSelect } = useSelfieSelection({ token })

  // Photo style settings
  const [photoStyleSettings, setPhotoStyleSettingsRaw] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [packageId, setPackageId] = useState<string>('headshot1')

  // Wrapper for setPhotoStyleSettings that also marks steps as visited on desktop
  const setPhotoStyleSettings = useCallback((newSettings: PhotoStyleSettingsType | ((prev: PhotoStyleSettingsType) => PhotoStyleSettingsType)) => {
    // Get current settings to detect changes
    setPhotoStyleSettingsRaw(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings

      // On desktop, detect which fields changed and mark them as visited
      // Use setTimeout to avoid setting state inside state setter
      if (!isMobileViewport && customizationStepsMeta.stepKeys) {
        const changedKeys: string[] = []
        for (const key of customizationStepsMeta.stepKeys) {
          const prevValue = (prev as Record<string, unknown>)[key]
          const newValue = (updated as Record<string, unknown>)[key]
          if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
            changedKeys.push(key)
          }
        }

        if (changedKeys.length > 0) {
          // Schedule state update outside of the setter callback
          setTimeout(() => {
            setVisitedSteps(prevVisited => {
              const newSet = new Set(prevVisited)
              for (const key of changedKeys) {
                newSet.add(key)
              }
              return newSet
            })
          }, 0)
        }
      }

      return updated
    })
  }, [isMobileViewport, customizationStepsMeta.stepKeys])

  const fetchDashboardData = useCallback(async () => {
    try {
      const statsResponse = await fetch(`/api/team/member/stats?token=${token}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (!isNonNullObject(statsData) || !isNonNullObject(statsData.stats)) {
          throw new Error('Invalid stats response')
        }
        setStats(statsData.stats as unknown as DashboardStats)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [token])

  const loadContextSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/context?token=${encodeURIComponent(token)}`)

      if (!response.ok) {
        throw new Error('Failed to fetch context')
      }

      const data = await response.json()
      if (
        !isNonNullObject(data) ||
        (data.context && !isNonNullObject(data.context))
      ) {
        throw new Error('Invalid context payload')
      }

      if (!data.context) {
        throw new Error('No context found')
      }

      const contextData = data.context as { id: string; settings?: Record<string, unknown> }

      const { extractPackageId } = await import('@/domain/style/settings-resolver')
      const extractedPackageId = (data.packageId as string | undefined) || extractPackageId(contextData.settings ?? {}) || 'headshot1'

      const pkg = getPackageConfig(extractedPackageId)
      const deserializedSettings = contextData.settings
        ? pkg.persistenceAdapter.deserialize(contextData.settings)
        : pkg.defaultSettings

      setPhotoStyleSettings(deserializedSettings)
      setOriginalContextSettings(deserializedSettings)
      setPackageId(pkg.id)
    } catch (error) {
      console.error('Error loading context settings:', error)
      const headshot1Pkg = getPackageConfig('headshot1')
      setPhotoStyleSettings(headshot1Pkg.defaultSettings)
      setPackageId('headshot1')
    }
  }, [token])

  const validateInvite = useCallback(async () => {
    try {
      const response = await fetch('/api/team/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()
      if (!isNonNullObject(data)) {
        throw new Error('Invalid invite response')
      }

      if (response.ok) {
        if (!isNonNullObject(data.invite)) {
          throw new Error('Invalid invite payload')
        }
        setInviteData(data.invite as unknown as InviteData)

        await loadContextSettings()

        if ((data.invite as unknown as InviteData).personId) {
          await fetchDashboardData()
        }
      } else {
        const errorText = (data as { error?: string }).error
        setError(errorText || 'Failed to validate invite')
      }
    } catch {
      setError('Failed to validate invite')
    } finally {
      setLoading(false)
    }
  }, [token, fetchDashboardData, loadContextSettings])

  const fetchAvailableSelfies = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/selfies?token=${token}&t=${Date.now()}`,
        { credentials: 'include', cache: 'no-store' as RequestCache }
      )
      if (response.ok) {
        const data = await response.json()
        const selfies = isNonNullObject(data) && Array.isArray((data as { selfies?: unknown }).selfies)
          ? (data as { selfies: Selfie[] }).selfies
          : []
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
        await fetchAvailableSelfies()
        const updatedResponse = await fetch(`/api/team/member/selfies?token=${token}`, {
          credentials: 'include'
        })
        if (!updatedResponse.ok) {
          throw new Error('Failed to refresh selfies')
        }
        const updatedData = await updatedResponse.json()
        const updatedSelfies = isNonNullObject(updatedData) && Array.isArray((updatedData as { selfies?: unknown }).selfies)
          ? (updatedData as { selfies: Selfie[] }).selfies
          : []
        const newSelfie = updatedSelfies.find((s) => s.key === key)
        if (newSelfie) {
          await toggleSelect(newSelfie.id, true)
        }
      }
      await loadSelected()
      await fetchAvailableSelfies()
    } catch (error) {
      console.error('Error selecting newly uploaded selfie:', error)
    }
  }, [toggleSelect, fetchAvailableSelfies, loadSelected, token])

  const handleMobileUploadApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    for (const { key, selfieId } of results) {
      await selectUploadedSelfie(key, selfieId)
    }
  }, [selectUploadedSelfie])

  useEffect(() => {
    if (token) {
      validateInvite()
    }
  }, [token, validateInvite])

  // Fetch selfies and selections on mount
  useEffect(() => {
    fetchAvailableSelfies()
    loadSelected()
  }, [fetchAvailableSelfies, loadSelected])

  // Initialize local visitedSteps from persisted session storage
  // Convert persisted indices to step keys using customizationStepsMeta.stepKeys
  useEffect(() => {
    if (persistedVisitedIndices.length > 0 && customizationStepsMeta.stepKeys) {
      const stepKeys = customizationStepsMeta.stepKeys
      const visitedKeys = persistedVisitedIndices
        .map(idx => stepKeys[idx])
        .filter((key): key is string => !!key)
      if (visitedKeys.length > 0) {
        setVisitedSteps(prev => {
          // Only update if we have new keys to add
          const newSet = new Set(prev)
          let hasNew = false
          for (const key of visitedKeys) {
            if (!newSet.has(key)) {
              newSet.add(key)
              hasNew = true
            }
          }
          return hasNew ? newSet : prev
        })
      }
    }
  }, [persistedVisitedIndices, customizationStepsMeta.stepKeys])

  // Filter selectedIds to only include selfies that actually exist
  const validSelectedIds = useMemo(() =>
    selectedIds.filter(id => availableSelfies.some(s => s.id === id)),
    [selectedIds, availableSelfies]
  )

  // Check if all customizable sections are customized
  // IMPORTANT: Only determine this after originalContextSettings is loaded
  // Otherwise we might incorrectly show customization as complete before data loads
  const customizationStillRequired = originalContextSettings
    ? hasUneditedEditableFields(
        photoStyleSettings as Record<string, unknown>,
        originalContextSettings as Record<string, unknown>,
        packageId || 'headshot1'
      )
    : true // Assume required until data loads

  // Check if clothing colors is editable (not admin preset)
  const isClothingColorsEditable = useMemo(() => {
    const categorySettings = (originalContextSettings || photoStyleSettings) as Record<string, unknown>
    const clothingColorsSettings = categorySettings['clothingColors'] as { type?: string; mode?: string } | undefined
    // If no settings or mode is 'user-choice', it's editable
    return !clothingColorsSettings ||
      clothingColorsSettings.mode === 'user-choice' ||
      clothingColorsSettings.type === 'user-choice'
  }, [originalContextSettings, photoStyleSettings])

  // Check if clothing colors step has been visited (for mobile flow only, and only if editable)
  const hasVisitedClothingColors = !isMobileViewport || !isClothingColorsEditable || visitedSteps.has('clothingColors')

  // Check if all editable steps have been visited (user has reviewed all options)
  const allEditableStepsVisited = customizationStepsMeta.editableSteps > 0 &&
    visitedSteps.size >= customizationStepsMeta.editableSteps

  // Customization is complete if either:
  // 1. All editable steps have been visited (user reviewed everything), OR
  // 2. All values have been explicitly changed from original
  const isCustomizationComplete = allEditableStepsVisited || !customizationStillRequired

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
      const stepsVisited = visitedSteps.size
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
  }, [canGenerate, validSelectedIds.length, stats.creditsRemaining, isCustomizationComplete, hasVisitedClothingColors, isMobileViewport, isClothingColorsEditable, visitedSteps.size, customizationStepsMeta.editableSteps, t])

  const handleMobileStepChange = useCallback((step: MobileStep | null, stepIndex?: number) => {
    const stepId = step?.custom?.id ?? step?.category?.key ?? null
    setActiveMobileStepInfo({
      type: step?.type ?? null,
      id: stepId,
      index: stepIndex ?? 0
    })
    if (stepId) {
      setVisitedSteps(prev => {
        const newSet = new Set(prev)
        newSet.add(stepId)
        return newSet
      })
    }
  }, [])

  // Navigation helper: go back to customization intro
  const handleBack = useCallback(() => {
    router.push(`/invite-dashboard/${token}/customization-intro`)
  }, [router, token])

  // Navigation helper: go back to dashboard
  const goBackToDashboard = useCallback(() => {
    clearFlow()
    router.replace(`/invite-dashboard/${token}`)
  }, [clearFlow, router, token])

  // Navigation handlers for FlowProgressDock
  const handleNavigateToSelfies = useCallback(() => {
    router.push(`/invite-dashboard/${token}/selfies`)
  }, [router, token])

  const handleNavigateToCustomize = useCallback(() => {
    // Already here
  }, [])

  const handleNavigateToSelfieTips = useCallback(() => {
    router.push(`/invite-dashboard/${token}/selfie-tips`)
  }, [router, token])

  const handleNavigateToCustomizationIntro = useCallback(() => {
    router.push(`/invite-dashboard/${token}/customization-intro`)
  }, [router, token])

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (validSelectedIds.length < 2) {
      alert(t('alerts.selectAtLeastTwoSelfies'))
      return
    }

    // Validate all customizable sections are customized
    if (!isCustomizationComplete) {
      alert(t('alerts.customizePhoto', { default: 'Please customize your photo settings before generating' }))
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
      alert(creditMessage)
      return
    }

    // Prevent double-clicks
    if (isGenerating) return

    try {
      setIsGenerating(true)

      const requestBody: Record<string, unknown> = {
        generationType: 'team',
        creditSource: 'team',
        contextId: inviteData?.contextId,
        styleSettings: { ...photoStyleSettings, packageId },
        prompt: generatePromptFromSettings(photoStyleSettings),
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
          team_name: inviteData?.teamName,
          selfie_count: validSelectedIds.length
        })

        if (typeof window !== 'undefined') {
          const wasFirstGeneration = stats.photosGenerated === 0

          if (wasFirstGeneration) {
            fetch('/api/onboarding/pending-tour', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tourName: 'generation-detail' }),
            }).catch(error => {
              console.error('Failed to set pending tour:', error)
            })
          }
        }

        setIsGenerating(false)
        clearFlow()
        router.push(`/invite-dashboard/${token}/generations`)
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Generation failed:', error)
        alert(error.message || error.error || t('alerts.generationFailed'))
        setIsGenerating(false)
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      alert(t('alerts.generationFailed'))
      setIsGenerating(false)
    }
  }

  const generatePromptFromSettings = (settings: PhotoStyleSettingsType) => {
    const promptParts = []

    if (settings.style?.preset) {
      promptParts.push(`${settings.style.preset} style`)
    }

    if (settings.background?.value?.type) {
      promptParts.push(`${settings.background.value.type} background`)
    }

    if (settings.clothing?.value?.style) {
      promptParts.push(`${settings.clothing.value.style} clothing`)
    }

    if (settings.expression?.value?.type) {
      promptParts.push(`${settings.expression.value.type} expression`)
    }

    if (settings.lighting?.type) {
      promptParts.push(`${settings.lighting.type} lighting`)
    }

    if (promptParts.length === 0) {
      return 'Professional headshot with corporate style'
    }

    return `Professional headshot with ${promptParts.join(', ')}`
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
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
              onClick={() => router.push(`/invite-dashboard/${token}`)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              {t('error.goToHomepage')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!inviteData) return null

  const photosAffordable = Math.floor(stats.creditsRemaining / PRICING_CONFIG.credits.perGeneration)

  // Create the header component for reuse
  const inviteHeader = (
    <InviteDashboardHeader
      token={token}
      teamName={inviteData.teamName}
      creditsRemaining={stats.creditsRemaining}
      photosAffordable={photosAffordable}
      showBackToDashboard
      onBackClick={goBackToDashboard}
      hideTitle
    />
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - hidden on mobile (handled by StyleSettingsSection) */}
      <div className="hidden md:block">
        {inviteHeader}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-8 py-0">
        <SwipeableContainer
          onSwipeRight={isSwipeEnabled && activeMobileStepInfo.index === 0 ? handleBack : undefined}
          onSwipeLeft={undefined}
          enabled={isSwipeEnabled && activeMobileStepInfo.index === 0}
        >
          <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6 pb-44 md:pb-52">
            {/* Mobile: Style settings, cost, and sticky controls */}
            <div className="md:hidden space-y-6">
              <StyleSettingsSection
                value={photoStyleSettings}
                onChange={setPhotoStyleSettings}
                readonlyPredefined={true}
                originalContextSettings={originalContextSettings}
                showToggles={false}
                packageId={packageId || 'headshot1'}
                noContainer
                teamContext
                token={token}
                onMobileStepChange={handleMobileStepChange}
                onSwipeBack={handleBack}
                onStepMetaChange={setCustomizationStepsMeta}
                topHeader={inviteHeader}
                onNavigationReady={setNavMethods}
                hideInlineNavigation={true}
                onStepIndicatorChange={setStepIndicatorProps}
              />
            </div>

            {/* Fixed sticky controls at bottom - Mobile */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white pt-3 pb-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              {/* Labeled navigation buttons row */}
              <div className="flex items-center justify-between pb-3">
                {/* Back to Selfies */}
                <button
                  type="button"
                  onClick={() => {
                    if (stepIndicatorProps?.currentAllStepsIndex === 0) {
                      router.push(`/invite-dashboard/${token}/selfies`)
                    } else {
                      navMethods?.goPrev()
                    }
                  }}
                  className="flex items-center gap-2 pr-4 pl-3 h-11 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-medium">
                    {stepIndicatorProps?.currentAllStepsIndex === 0
                      ? t('selfieSelection.mobile.navigation.selfies', { default: 'Selfies' })
                      : t('selfieSelection.mobile.navigation.back', { default: 'Back' })}
                  </span>
                </button>

                {/* Forward - Generate or Next */}
                {canGenerate ? (
                  <button
                    type="button"
                    onClick={onProceed}
                    disabled={isGenerating}
                    className="flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition"
                  >
                    <span className="text-sm font-semibold">{t('selfieSelection.mobile.navigation.generate', { default: 'Generate' })}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navMethods?.goNext()}
                    disabled={(stepIndicatorProps?.currentAllStepsIndex ?? 0) >= ((stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1) - 1)}
                    className={`flex items-center gap-2 pl-4 pr-3 h-11 rounded-full shadow-sm transition ${
                      (stepIndicatorProps?.currentAllStepsIndex ?? 0) < ((stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1) - 1)
                        ? 'bg-brand-primary text-white hover:brightness-110'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm font-medium">{t('selfieSelection.mobile.navigation.next', { default: 'Next' })}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Progress dots */}
              <div className="pb-3">
                <FlowNavigation
                  variant="dots-only"
                  size="md"
                  current={stepIndicatorProps?.currentAllStepsIndex ?? 0}
                  total={stepIndicatorProps?.totalWithLocked ?? stepIndicatorProps?.total ?? 1}
                  onPrev={() => {
                    if (stepIndicatorProps?.currentAllStepsIndex === 0) {
                      handleBack()
                    } else {
                      navMethods?.goPrev()
                    }
                  }}
                  onNext={() => navMethods?.goNext()}
                  stepColors={stepIndicatorProps ? {
                    lockedSteps: stepIndicatorProps.lockedSteps,
                    visitedEditableSteps: stepIndicatorProps.visitedEditableSteps
                  } : undefined}
                />
              </div>
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
                    onError={(message) => console.error('Upload error:', message)}
                  />
                </div>
              ) : (
                <GenerateButton
                  onClick={onProceed}
                  disabled={!canGenerate}
                  isGenerating={isGenerating}
                  size="md"
                  disabledReason={disabledReason}
                >
                  {t('styleSelection.generateButton')}
                </GenerateButton>
              )}
            </div>

            <StyleSettingsSection
              value={photoStyleSettings}
              onChange={setPhotoStyleSettings}
              readonlyPredefined={true}
              originalContextSettings={originalContextSettings}
              showToggles={false}
              packageId={packageId || 'headshot1'}
              noContainer
              teamContext
              className="hidden md:block"
              token={token}
              onStepMetaChange={setCustomizationStepsMeta}
            />
          </div>
        </SwipeableContainer>
      </div>

      {/* Desktop: FlowProgressDock */}
      <FlowProgressDock
        selfieCount={validSelectedIds.length}
        uneditedFields={!isCustomizationComplete ? ['customization'] : []}
        hasUneditedFields={!isCustomizationComplete}
        canGenerate={canGenerate}
        hasEnoughCredits={stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration}
        currentStep="customize"
        onNavigateToSelfies={handleNavigateToSelfies}
        onNavigateToCustomize={handleNavigateToCustomize}
        onGenerate={onProceed}
        isGenerating={isGenerating}
        onNavigateToDashboard={() => router.push(`/invite-dashboard/${token}`)}
        customizationStepsMeta={customizationStepsMeta}
        visitedEditableSteps={
          // When customization is complete (all values changed), mark all steps as visited
          isCustomizationComplete && customizationStepsMeta.editableSteps > 0
            ? Array.from({ length: customizationStepsMeta.editableSteps }, (_, i) => i)
            : customizationStepsMeta.stepKeys
              ? Array.from(visitedSteps)
                  .map(stepKey => customizationStepsMeta.stepKeys!.indexOf(stepKey))
                  .filter(idx => idx >= 0)
              : []
        }
      />
    </div>
  )
}
