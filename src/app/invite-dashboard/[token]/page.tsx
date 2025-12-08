'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { 
  PhotoIcon, 
} from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import type { MobileStep } from '@/components/customization/PhotoStyleSettings'
import { SelectableGrid } from '@/components/generation/selection'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'
import GenerateButton from '@/components/generation/GenerateButton'
import { Grid } from '@/components/ui'
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
import { SwipeableContainer } from '@/components/generation/navigation'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'

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

// Flow step state machine - simplified with route-based intros
// Intro steps (selfie tips, customization intro) are now separate routes
type InviteFlowStep = 
  | 'dashboard'           // Initial state - show dashboard
  | 'selfieSelection'     // Select/upload selfies
  | 'customization'       // Style settings (one page desktop, swipe cards mobile)

export default function InviteDashboardPage() {
  const SHOW_CONTEXT_SUMMARY = false;
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
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
  const [emailResent, setEmailResent] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Generation type for team members (defaults to 'team' in onProceed)
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  
  // Flow step state machine - replaces showStartFlow/showStyleSelection
  // Derived from flow flags and state, updated directly in navigation handlers
  const [flowStepState, setFlowStepState] = useState<InviteFlowStep | null>(null)
  const [availableSelfies, setAvailableSelfies] = useState<Selfie[]>([])
  const [recentPhotoUrls, setRecentPhotoUrls] = useState<string[]>([])
  const [activeMobileStepInfo, setActiveMobileStepInfo] = useState<{ type: MobileStep['type'] | null, id: string | null, index: number }>({
    type: null,
    id: null,
    index: 0
  })
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set())
  const isMobileViewport = useMobileViewport()
  const isSwipeEnabled = useSwipeEnabled()
  
  const { uploadEndpoint: inviteUploadEndpoint, saveEndpoint: inviteSaveEndpoint } = useInviteSelfieEndpoints(token)
  const {
    flags: flowFlags,
    inFlow,
    markInFlow,
    clearFlow,
    setPendingGeneration,
    setOpenStartFlow,
    hasSeenSelfieTips,
    hasSeenCustomizationIntro,
    hydrated,
    setCustomizationStepsMeta
  } = useGenerationFlowState()
  const markGenerationFlow = useCallback((options?: { pending?: boolean }) => {
    markInFlow(options)
  }, [markInFlow])
  const clearGenerationFlow = useCallback(() => {
    clearFlow()
  }, [clearFlow])
  
  // Multi-select: load and manage selected selfies for invited flow
  const { selectedSet, selectedIds, loadSelected, toggleSelect } = useSelfieSelection({ token })
  
  // Photo style settings
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [packageId, setPackageId] = useState<string>('headshot1')

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
      // Fetch context using token-based API endpoint (since invite dashboard doesn't use session auth)
      // The endpoint gets the context from the invite/team, so no contextId needed
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

      // Extract packageId from API response or context settings
      const contextData = data.context as { id: string; settings?: Record<string, unknown> }

      const { extractPackageId } = await import('@/domain/style/settings-resolver')
      const extractedPackageId = (data.packageId as string | undefined) || extractPackageId(contextData.settings ?? {}) || 'headshot1'
      
      // Get package config and deserialize settings using package deserializer
      // This properly handles all fields including clothingColors, shotType, background, and branding
      const pkg = getPackageConfig(extractedPackageId)
      const deserializedSettings = contextData.settings 
        ? pkg.persistenceAdapter.deserialize(contextData.settings)
        : pkg.defaultSettings
      
      // Use deserialized settings directly - the package deserializer already handles everything correctly
      // including preserving preset values for background, branding, and other categories
      setPhotoStyleSettings(deserializedSettings)
      setOriginalContextSettings(deserializedSettings)
      setPackageId(pkg.id)
    } catch (error) {
      console.error('Error loading context settings:', error)
      // Fallback to headshot1 defaults on error
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
        
        // Load context settings (endpoint gets context from invite/team)
        await loadContextSettings()
        
        // Fetch dashboard data after validating invite
        if ((data.invite as unknown as InviteData).personId) {
          await fetchDashboardData()
        }
      } else {
        const expired = Boolean((data as { expired?: boolean }).expired)
        const emailResent = Boolean((data as { emailResent?: boolean }).emailResent)
        const message = (data as { message?: string }).message
        const errorText = (data as { error?: string }).error

        if (expired && emailResent) {
          setEmailResent(true)
          setError(message || errorText || 'Invite expired')
        } else {
          setError(errorText || 'Failed to validate invite')
        }
      }
    } catch {
      setError('Failed to validate invite')
    } finally {
      setLoading(false)
    }
  }, [token, fetchDashboardData, loadContextSettings])

  // Fetch recent generated photos (up to last 8)
  const fetchRecentPhotos = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/member/generations?token=${token}`)
      if (!response.ok) return
      const data = await response.json()
      const generations = isNonNullObject(data) && Array.isArray((data as { generations?: unknown }).generations)
        ? (data as { generations: Array<{ id: string; createdAt: string; status: 'pending' | 'processing' | 'completed' | 'failed'; generatedPhotos: Array<{ id: string; url: string }> }> }).generations
        : []
      const gens = generations
        .filter(g => g.status === 'completed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const urls: string[] = []
      for (const g of gens) {
        for (const p of g.generatedPhotos) {
          urls.push(p.url)
          if (urls.length >= 8) break
        }
        if (urls.length >= 8) break
      }
      setRecentPhotoUrls(urls)
    } catch (err) {
      // Non-blocking; ignore errors here
      console.error('Error fetching recent photos:', err)
    }
  }, [token])

  const fetchAvailableSelfies = useCallback(async () => {
    try {
      // Bust caches and ensure cookies are sent (Safari quirk)
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
      fetchRecentPhotos()
    }
  }, [token, validateInvite, fetchRecentPhotos])

  // Derive flow step from state - no useEffect needed
  // Priority: explicit state > pendingGeneration > openStartFlow > inFlow with customization intro > dashboard
  const flowStep = useMemo<InviteFlowStep>(() => {
    // If we have explicit state, use it
    if (flowStepState !== null) {
      return flowStepState
    }
    
    // If not hydrated yet, stay on dashboard
    if (!hydrated) {
      return 'dashboard'
    }
    
    // If pendingGeneration is set, we're returning from selfie upload - go to selfie selection
    if (flowFlags.pendingGeneration) {
      return 'selfieSelection'
    }
    
    // If openStartFlow is true, determine step based on customization intro
    // This handles navigation from selfies page when continuing
    if (flowFlags.openStartFlow) {
      return hasSeenCustomizationIntro ? 'customization' : 'selfieSelection'
    }
    
    // If in flow and customization intro has been seen, go to customization
    // This handles navigation from customization-intro page back to dashboard
    // BUT only if we're actually in the flow (not just a stale flag)
    if (inFlow && hasSeenCustomizationIntro && hasSeenSelfieTips) {
      return 'customization'
    }
    
    // If in flow but haven't seen customization intro yet, go to selfie selection
    if (inFlow && !hasSeenCustomizationIntro) {
      return 'selfieSelection'
    }
    
    // Default to dashboard
    return 'dashboard'
  }, [flowStepState, hydrated, inFlow, flowFlags.openStartFlow, flowFlags.pendingGeneration, hasSeenCustomizationIntro, hasSeenSelfieTips])

  // Fetch selfies when entering any flow step (not dashboard)
  useEffect(() => {
    if (flowStep !== 'dashboard') {
      fetchAvailableSelfies()
      loadSelected()
    }
  }, [flowStep, fetchAvailableSelfies, loadSelected])

  // Filter selectedIds to only include selfies that actually exist in the current list
  // This prevents stale selections from showing incorrect counts
  const validSelectedIds = useMemo(() => 
    selectedIds.filter(id => availableSelfies.some(s => s.id === id)),
    [selectedIds, availableSelfies]
  )
  
  // Derived state for flow step conditions
  const isInFlow = flowStep !== 'dashboard'

  // Check if returning from selfie upload after starting generation
  useEffect(() => {
    if (!flowFlags.pendingGeneration) return
    setFlowStepState('selfieSelection')
    fetchAvailableSelfies()
    loadSelected()
    const retry = setTimeout(() => {
      fetchAvailableSelfies()
      loadSelected()
    }, 800)
    return () => clearTimeout(retry)
  }, [flowFlags.pendingGeneration, fetchAvailableSelfies, loadSelected])

  // Set up generation flow once selfies are fetched
  useEffect(() => {
    if (!flowFlags.pendingGeneration) return
    let cancelled = false
    const syncLatestSelfies = async () => {
      await fetchAvailableSelfies()
      await loadSelected()
      if (!cancelled) {
        setPendingGeneration(false)
      }
    }
    void syncLatestSelfies()
    return () => {
      cancelled = true
    }
  }, [flowFlags.pendingGeneration, fetchAvailableSelfies, loadSelected, setPendingGeneration])

  // Check if all customizable sections are customized (composable - works with any package)
  const customizationStillRequired = originalContextSettings
    ? hasUneditedEditableFields(
        photoStyleSettings as Record<string, unknown>,
        originalContextSettings as Record<string, unknown>,
        packageId || 'headshot1'
      )
    : false

  // Check if clothing colors step has been visited (for mobile flow only)
  // On mobile, user must scroll through all steps before generating
  const hasVisitedClothingColors = !isMobileViewport || visitedSteps.has('clothingColors')
  
  const canGenerate = validSelectedIds.length >= 2 && 
                      stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration &&
                      !customizationStillRequired &&
                      hasVisitedClothingColors

  const handleMobileStepChange = useCallback((step: MobileStep | null, stepIndex?: number) => {
    const stepId = step?.custom?.id ?? step?.category?.key ?? null
    setActiveMobileStepInfo({
      type: step?.type ?? null,
      id: stepId,
      index: stepIndex ?? 0
    })
    // Track visited steps (by category key for customization steps)
    if (stepId) {
      setVisitedSteps(prev => {
        const newSet = new Set(prev)
        newSet.add(stepId)
        return newSet
      })
    }
  }, [])

  // Navigation helper: determine initial step when starting the flow
  const handleStartFlow = useCallback(() => {
    // Clear any existing flow flags and explicit state
    clearGenerationFlow()
    setFlowStepState(null)
    setOpenStartFlow(false)

    // Check if user has enough selfies to skip selfie upload flow
    if (selectedIds.length >= MIN_SELFIES_REQUIRED) {
      // User has enough selfies, skip directly to customization-intro
      router.push(`/invite-dashboard/${token}/customization-intro`)
    } else {
      // Not enough selfies, redirect to selfie-tips intro page (will auto-skip if already seen)
      router.push(`/invite-dashboard/${token}/selfie-tips`)
    }
  }, [clearGenerationFlow, setOpenStartFlow, router, token, selectedIds.length])

  // Navigation helper: go to next step from current step
  const goToNextStep = useCallback(() => {
    switch (flowStep) {
      case 'selfieSelection':
        // Navigate to customization intro (route-based)
        router.push(`/invite-dashboard/${token}/customization-intro`)
        break
      default:
        break
    }
  }, [flowStep, router, token])

  // Navigation helper: go back to dashboard
  const goBackToDashboard = useCallback(() => {
    clearGenerationFlow()
    setFlowStepState('dashboard')
    setGenerationType(null)
    router.replace(`/invite-dashboard/${token}`)
  }, [clearGenerationFlow, router, token])

  // Navigation helper: swipe back from customization to customization intro
  const handleSwipeBackFromCustomization = useCallback(() => {
    router.push(`/invite-dashboard/${token}/customization-intro`)
  }, [router, token])

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (validSelectedIds.length < 2) {
      alert(t('alerts.selectAtLeastTwoSelfies'))
      return
    }
    
    // Validate all customizable sections are customized
    if (customizationStillRequired) {
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

      // Ensure generationType is a string, not an array
      let finalGenerationType = Array.isArray(generationType) ? generationType[0] : generationType
      
      // Additional safeguard: ensure it's a valid string
      if (!finalGenerationType || typeof finalGenerationType !== 'string') {
        finalGenerationType = 'team'
      }
      
      const requestBody: Record<string, unknown> = {
        generationType: finalGenerationType,
        creditSource: 'team', // Use team credits for team members
        contextId: inviteData?.contextId, // Pass the context ID from the invite
        // Add style settings from photo style settings, including packageId
        styleSettings: { ...photoStyleSettings, packageId },
        // Generate a prompt from the photo style settings
        prompt: generatePromptFromSettings(photoStyleSettings),
        selfieIds: validSelectedIds,
        // Debug flags (workflow version is controlled by GENERATION_WORKFLOW_VERSION env var on server)
        debugMode: process.env.NODE_ENV !== 'production' // Enable debug mode only in development (logs prompts, saves intermediate files)
      }
      
      // Use token-authenticated endpoint for invite dashboard flows
      const response = await fetch(`/api/team/member/generations/create?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Ensure cookies are sent on mobile Safari and avoid cached auth states
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        // Set generation-detail tour as pending in database for first generation
        // Only for users who have accepted invites (have personId)
        if (typeof window !== 'undefined') {
          const wasFirstGeneration = stats.photosGenerated === 0

          if (wasFirstGeneration) {
            // Set the tour as pending in database for when user views generations
            fetch('/api/onboarding/pending-tour', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tourName: 'generation-detail' }),
            }).catch(error => {
              console.error('Failed to set pending tour:', error)
            })
          }
        }
        
        // Reset generating state before redirect
        setIsGenerating(false)
        
        // Redirect to generations page to see the result
        clearGenerationFlow()
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
    // Generate a prompt based on the photo style settings
    const promptParts = []
    
    // Add style information
    if (settings.style?.preset) {
      promptParts.push(`${settings.style.preset} style`)
    }
    
    // Add background information
    if (settings.background?.type) {
      promptParts.push(`${settings.background.type} background`)
    }
    
    // Add clothing information
    if (settings.clothing?.style) {
      promptParts.push(`${settings.clothing.style} clothing`)
    }
    
    // Add expression information
    if (settings.expression?.type) {
      promptParts.push(`${settings.expression.type} expression`)
    }
    
    // Add lighting information
    if (settings.lighting?.type) {
      promptParts.push(`${settings.lighting.type} lighting`)
    }
    
    // Default prompt if no settings are specified
    if (promptParts.length === 0) {
      return 'Professional headshot with corporate style'
    }
    
    return `Professional headshot with ${promptParts.join(', ')}`
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
            {emailResent ? (
              <>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('expired.title')}</h1>
                <p className="text-sm text-gray-600 mb-3">{error}</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <p className="text-xs text-blue-800 font-medium mb-1">{t('expired.securityTitle')}</p>
                  <p className="text-xs text-blue-700 leading-relaxed">{t('expired.securityMessage')}</p>
                </div>
                <p className="text-xs text-gray-500 mb-4">{t('expired.checkInbox')}</p>
                <button
                  onClick={() => router.push(`/${locale}`)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                >
                  {t('expired.goToHomepage')}
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('error.invalidInvite')}</h1>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
                <button
                  onClick={() => router.push(`/${locale}`)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                >
                  {t('error.goToHomepage')}
                </button>
              </>
            )}
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
      title=""
      teamName={inviteData.teamName}
      creditsRemaining={stats.creditsRemaining}
      photosAffordable={photosAffordable}
      showBackToDashboard={isInFlow}
      onBackClick={goBackToDashboard}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - hidden on mobile during customization step (handled by StyleSettingsSection) */}
      <div className={flowStep === 'customization' ? 'hidden md:block' : ''}>
        {inviteHeader}
      </div>
      {/* Invite dashboard does not show selected selfies or a Generate button.
          Actions live in Selfies and Generations pages. */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Insufficient credits warning */}
          {stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-base font-medium text-yellow-800 mb-1">
                    {t('insufficientCredits.title')}
                  </h3>
                  <p className="text-sm text-yellow-700">
                    {stats.adminName 
                      ? t('insufficientCredits.messageWithName', { 
                          adminName: stats.adminName, 
                          adminEmail: stats.adminEmail || t('insufficientCredits.yourTeamAdmin')
                        })
                      : stats.adminEmail 
                      ? t('insufficientCredits.messageWithEmail', { adminEmail: stats.adminEmail })
                      : t('insufficientCredits.messageGeneric')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Context summary - hidden for now */}
          {SHOW_CONTEXT_SUMMARY && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Team: {inviteData.teamName}</span>
              {inviteData.email && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Invite for: {inviteData.email}</span>
              )}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Credits: {stats.creditsRemaining}</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Selfie: {availableSelfies.length > 0 ? 'Uploaded' : 'Not uploaded'}</span>
                    </div>
          )}

                    {flowStep === 'dashboard' && (
           <Grid cols={{ mobile: 1, desktop: 2 }} gap="lg">
                        {/* Primary CTA - Prominent Generate Button */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="hidden md:block text-lg md:text-xl font-semibold text-gray-900 mb-2">{t('getStarted.title')}</h3>
              <p className="hidden md:block text-sm text-gray-600 mb-4">{t('getStarted.description')}</p>
              <div className="space-y-3">
                {/* Sticky wrapper for mobile */}
                <div className="md:static sticky bottom-0 md:bottom-auto z-10 bg-white md:bg-transparent pt-4 md:pt-0 pb-4 md:pb-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none -mx-6 md:mx-0 px-6 md:px-0">
                  <button 
                    onClick={handleStartFlow}
                    disabled={stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration}
                    className="w-full flex items-center justify-center px-6 py-5 bg-brand-primary text-white rounded-2xl hover:bg-brand-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-primary shadow-md hover:shadow-lg font-semibold text-base md:text-lg"
                  >
                    <PhotoIcon className="h-7 w-7 mr-3" />
                    <span>{t('getStarted.startButton')}</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  {stats.teamPhotosGenerated > 0 && (
                    <button 
                      onClick={() => router.push(`/invite-dashboard/${token}/generations`)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    > 
                      {t('getStarted.viewTeamPhotos', { count: stats.teamPhotosGenerated })}
                    </button>
                  )}
                  {stats.selfiesUploaded > 0 && (
                  <button 
                      onClick={() => {
                        // Clear generation flow flags when managing selfies
                        clearGenerationFlow()
                        router.push(`/invite-dashboard/${token}/selfies`)
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    > 
                      {t('getStarted.manageSelfies', { count: stats.selfiesUploaded })}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Recent photos thumbnails */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">{t('recentPhotos.title')}</h3>
                <button
                  onClick={() => router.push(`/invite-dashboard/${token}/generations`)}
                  className="text-sm text-brand-primary hover:text-brand-primary-hover"
                >
                  {t('recentPhotos.viewAll')}
                </button>
              </div>
              {recentPhotoUrls.length === 0 ? (
                <div className="flex items-center justify-center h-28 text-center text-sm text-gray-600 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <PhotoIcon className="h-5 w-5 text-gray-400" />
                    <span>{t('recentPhotos.empty')}</span>
                  </div>
                </div>
              ) : (
                <Grid cols={{ mobile: 4 }} gap="sm">
                  {recentPhotoUrls.slice(0, 8).map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative aspect-square overflow-hidden rounded-md bg-gray-100">
                      <Image src={url} alt={`Recent photo ${idx + 1}`} fill className="object-cover" unoptimized />
                    </div>
                  ))}
                </Grid>
              )}
            </div>
        </Grid>
          )}

          {/* Selfie selection step */}
          {flowStep === 'selfieSelection' && (
            <div className="space-y-6">
              {/* Selfie selection content */}
              {availableSelfies.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {/* Desktop: Title and continue button */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900">{t('selfieSelection.title')}</h3>
                    <button
                      onClick={() => {
                        if (validSelectedIds.length >= MIN_SELFIES_REQUIRED) {
                          goToNextStep()
                        }
                      }}
                      disabled={validSelectedIds.length < MIN_SELFIES_REQUIRED}
                      className="px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold shadow-md"
                    >
                      {t('common.continue')}
                    </button>
                  </div>
                  {/* Info banner */}
                  <SelfieSelectionInfoBanner selectedCount={validSelectedIds.length} className="mb-4" />
                  <SelectableGrid
                    items={availableSelfies}
                    selection={{ 
                      mode: 'controlled', 
                      selectedIds: selectedSet, 
                      onToggle: toggleSelect 
                    }}
                    showUploadTile
                    onUploadClick={() => {
                      markGenerationFlow({ pending: true })
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
                    showLoadingState={false}
                  />
                </div>
              )}
              {/* Empty state - no selfies yet */}
              {availableSelfies.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                  <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('selfieSelection.noSelfies', { default: 'No selfies yet' })}</h3>
                  <p className="text-sm text-gray-600 mb-4">{t('selfieSelection.uploadFirst', { default: 'Upload your first selfie to get started' })}</p>
                  <button
                    onClick={() => {
                      markGenerationFlow({ pending: true })
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
                    className="px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover text-base font-semibold shadow-md"
                  >
                    {t('selfieSelection.uploadButton', { default: 'Upload Selfies' })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Customization step - style selection */}
          {flowStep === 'customization' && (
            <SwipeableContainer
              onSwipeRight={isSwipeEnabled && activeMobileStepInfo.index === 0 ? handleSwipeBackFromCustomization : undefined}
              onSwipeLeft={undefined}
              enabled={isSwipeEnabled && activeMobileStepInfo.index === 0}
            >
                <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6 pb-24 md:pb-6">
                  <h1 className="hidden md:block text-2xl md:text-3xl font-bold text-gray-900 mb-4 font-display">{t('styleSelection.readyToGenerate')}</h1>
                  
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
                      onSwipeBack={handleSwipeBackFromCustomization}
                      onStepMetaChange={setCustomizationStepsMeta}
                      topHeader={inviteHeader}
                    />
                    <div className="md:border-t md:border-gray-200 md:pt-5 pt-5">
                      <div className="hidden md:flex items-center justify-between mb-4">
                        <div>
                          <div className="text-sm text-gray-600">{t('styleSelection.costPerGeneration')}</div>
                          <div className="text-3xl font-bold text-gray-900">
                            {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)} {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration) === 1 ? t('common.photoCredit') : t('common.photoCredits')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Fixed sticky controls at bottom - Mobile */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white pt-4 pb-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
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
                      >
                        {t('styleSelection.generateButton')}
                      </GenerateButton>
                    )}
                  </div>

                  {/* Desktop: Original layout with selfie summary and generation details */}
                  <div className="hidden md:flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:flex-1 min-w-0">
                      {/* Selected Selfie Thumbnails */}
                      <div className="flex-none">
                        <div className={`grid ${selectedIds.length <= 2 ? 'grid-flow-col auto-cols-max grid-rows-1' : 'grid-rows-2 grid-flow-col'} gap-2 max-w-[220px]`}>
                          {selectedIds.map((id) => {
                            const selfie = availableSelfies.find(s => s.id === id)
                            if (!selfie) return null
                            return (
                              <div key={id} className="w-14 h-14 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <Image
                                  src={selfie.url}
                                  alt="Selected selfie"
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <GenerationSummaryTeam
                          type="team"
                          styleLabel={photoStyleSettings?.style?.preset || packageId}
                          remainingCredits={stats.creditsRemaining}
                          perGenCredits={PRICING_CONFIG.credits.perGeneration}
                          showGenerateButton={false}
                          teamName={inviteData?.teamName}
                          showTitle={false}
                          plain
                          inlineHint
                        />
                      </div>
                    </div>

                    {/* Cost and Generate Button - Better mobile layout */}
                    <div className="border-t md:border-t-0 pt-5 md:pt-0 md:text-right md:flex-none md:w-60">
                      <div className="flex items-center justify-between md:flex-col md:items-end mb-4 md:mb-0">
                        <div>
                          <div className="text-sm text-gray-600 md:text-right">{t('styleSelection.costPerGeneration')}</div>
                          <div className="text-3xl md:text-2xl font-bold text-gray-900">
                            {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)} {calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration) === 1 ? t('common.photoCredit') : t('common.photoCredits')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Fixed sticky button at bottom - Desktop */}
                  <div className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg pt-4 pb-4 px-6">
                    <div className="max-w-7xl mx-auto flex justify-end">
                      <div className="w-60">
                        <GenerateButton
                          onClick={onProceed}
                          disabled={!canGenerate}
                          isGenerating={isGenerating}
                          size="md"
                        disabledReason={customizationStillRequired ? t('alerts.customizePhoto', { default: 'Please customize your photo settings before generating' }) : undefined}
                        >
                          {t('styleSelection.generateButton')}
                        </GenerateButton>
                      </div>
                    </div>
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
                    className="hidden md:block mt-6 pt-6 border-t border-gray-200"
                    token={token}
                    onStepMetaChange={setCustomizationStepsMeta}
                  />
                </div>
            </SwipeableContainer>
          )}

          {/* Sign up CTA - Hidden on mobile */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:mt-6">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {t('signUpCta.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('signUpCta.description')}
            </p>
            <button
              onClick={() => window.location.href = 'https://www.photoshotspro.com'}
              className="px-4 py-2 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-cta-ring"
              style={{
                backgroundColor: BRAND_CONFIG.colors.cta,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
              }}
            >
              {t('signUpCta.button')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
