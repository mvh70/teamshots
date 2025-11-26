'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { 
  PhotoIcon, 
  CheckCircleIcon,
  CameraIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import SelectedSelfiePreview from '@/components/generation/SelectedSelfiePreview'
import SelfieSelectionGrid from '@/components/generation/SelfieSelectionGrid'
import SelfieSelectionInfoBanner from '@/components/generation/SelfieSelectionInfoBanner'
import GenerateButton from '@/components/generation/GenerateButton'
import Panel from '@/components/common/Panel'
import { Grid } from '@/components/ui'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { hasUserDefinedFields, areAllCustomizableSectionsCustomized } from '@/domain/style/userChoice'
import { DEFAULT_PHOTO_STYLE_SETTINGS, PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { getPackageConfig } from '@/domain/style/packages'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'

const SelfieApproval = dynamic(() => import('@/components/Upload/SelfieApproval'), { ssr: false })
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
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Upload flow state
  const [uploadKey, setUploadKey] = useState<string>('')
  const [isApproved, setIsApproved] = useState<boolean>(false)
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  
  // Generation flow state
  const [showGenerationFlow, setShowGenerationFlow] = useState<boolean>(false)
  const [showStartFlow, setShowStartFlow] = useState<boolean>(false)
  const [showStyleSelection, setShowStyleSelection] = useState<boolean>(false)
  const [availableSelfies, setAvailableSelfies] = useState<Selfie[]>([])
  const [selectedSelfie, setSelectedSelfie] = useState<string>('')
  const [recentPhotoUrls, setRecentPhotoUrls] = useState<string[]>([])
  
  // Multi-select: load and manage selected selfies for invited flow
  const { selectedSet, selectedIds, loadSelected, toggleSelect } = useSelfieSelection({ token })
  
  // Photo style settings
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(DEFAULT_PHOTO_STYLE_SETTINGS)
  const [originalContextSettings, setOriginalContextSettings] = useState<PhotoStyleSettingsType | undefined>(undefined)
  const [packageId, setPackageId] = useState<string>('headshot1')

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch(`/api/team/member/stats?token=${token}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
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

      const data = await response.json() as {
        context?: {
          id: string
          settings?: Record<string, unknown>
        }
        packageId?: string
      }

      if (!data.context) {
        throw new Error('No context found')
      }

      // Extract packageId from API response or context settings
      const { extractPackageId } = await import('@/domain/style/settings-resolver')
      const extractedPackageId = data.packageId || extractPackageId(data.context.settings as Record<string, unknown>) || 'headshot1'
      
      // Get package config and deserialize settings using package deserializer
      // This properly handles all fields including clothingColors, shotType, background, and branding
      const pkg = getPackageConfig(extractedPackageId)
      const deserializedSettings = data.context.settings 
        ? pkg.persistenceAdapter.deserialize(data.context.settings as Record<string, unknown>)
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

      if (response.ok) {
        setInviteData(data.invite)
        
        // Load context settings (endpoint gets context from invite/team)
        await loadContextSettings()
        
        // Fetch dashboard data after validating invite
        if (data.invite.personId) {
          await fetchDashboardData()
        }
      } else {
        setError(data.error)
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
      const data = await response.json() as { generations?: Array<{ id: string; createdAt: string; status: 'pending' | 'processing' | 'completed' | 'failed'; generatedPhotos: Array<{ id: string; url: string }> }> }
      const gens = (data.generations || [])
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
        setAvailableSelfies(data.selfies)
      }
    } catch (error) {
      console.error('Error fetching selfies:', error)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      validateInvite()
      fetchRecentPhotos()
    }
  }, [token, validateInvite, fetchRecentPhotos])

  // If returning from upload page, reopen the start flow
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldOpen = sessionStorage.getItem('openStartFlow') === 'true'
      if (shouldOpen) {
        setShowStartFlow(true)
        sessionStorage.removeItem('openStartFlow')
      }
    }
  }, [])

  useEffect(() => {
    if (showGenerationFlow || showStartFlow) {
      fetchAvailableSelfies()
      loadSelected()
    }
  }, [showGenerationFlow, showStartFlow, fetchAvailableSelfies, loadSelected])

  // Filter selectedIds to only include selfies that actually exist in the current list
  // This prevents stale selections from showing incorrect counts
  const validSelectedIds = useMemo(() => 
    selectedIds.filter(id => availableSelfies.some(s => s.id === id)),
    [selectedIds, availableSelfies]
  )

  // Auto-advance to style selection if we have 2+ selfies selected when start flow opens
  useEffect(() => {
    if (showStartFlow && !showStyleSelection && validSelectedIds.length >= 2 && availableSelfies.length > 0) {
      setShowStyleSelection(true)
    }
  }, [showStartFlow, showStyleSelection, validSelectedIds.length, availableSelfies.length])

  // Check if returning from selfie upload after starting generation
  useEffect(() => {
    const pendingGeneration = sessionStorage.getItem('pendingGeneration')
    if (pendingGeneration === 'true') {
      // Show the start flow UI immediately so user sees the flow, not just the banner
      setShowStartFlow(true)
      // Initial fetch
      fetchAvailableSelfies()
      loadSelected()
      // Quick one-shot retry to avoid race where DB write/replication lags
      const retry = setTimeout(() => {
        fetchAvailableSelfies()
        loadSelected()
      }, 800)
      return () => clearTimeout(retry)
    }
  }, [fetchAvailableSelfies, loadSelected])

  // Set up generation flow once selfies are fetched
  // Note: When returning from selfie approval, we show the start flow (with selfie selection)
  // instead of the old upload flow, so we don't set uploadKey here anymore
  useEffect(() => {
    const pendingGeneration = sessionStorage.getItem('pendingGeneration')
    if (pendingGeneration === 'true' && availableSelfies.length > 0) {
      // Clear the pending flag - the start flow is already showing and will handle the rest
      sessionStorage.removeItem('pendingGeneration')
    }
  }, [availableSelfies])

  const onApprove = () => {
    setIsApproved(true)
    // For team members, automatically set to team type
    setGenerationType('team')
  }

  const onRetake = async () => {
    await deleteSelfie()
  }

  const deleteSelfie = async () => {
    if (!uploadKey) return
    
    try {
      const response = await fetch(`/api/uploads/delete?key=${encodeURIComponent(uploadKey)}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setUploadKey('')
        setIsApproved(false)
      } else {
        console.error('Failed to delete selfie')
      }
    } catch (error) {
      console.error('Error deleting selfie:', error)
    }
  }

  // Check if all customizable sections are customized (composable - works with any package)
  const allCustomizableSectionsCustomized = areAllCustomizableSectionsCustomized(
    photoStyleSettings as Record<string, unknown>,
    packageId || 'headshot1',
    originalContextSettings as Record<string, unknown> | undefined
  )

  const canGenerate = validSelectedIds.length >= 2 && 
                      stats.creditsRemaining >= PRICING_CONFIG.credits.perGeneration &&
                      allCustomizableSectionsCustomized

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (validSelectedIds.length < 2) {
      alert(t('alerts.selectAtLeastTwoSelfies'))
      return
    }
    
    // Validate all customizable sections are customized
    if (!allCustomizableSectionsCustomized) {
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
        debugMode: true // Enable debug mode (logs prompts, saves intermediate files)
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

      console.log('Generation response status:', response.status, response.ok)

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}))
        console.log('Generation created successfully:', responseData)
        
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
        console.log('Redirecting to generations page:', `/invite-dashboard/${token}/generations`)
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

  

  // using shared hasUserDefinedFields from domain/style/userChoice

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
              onClick={() => router.push(`/${locale}`)}
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

  const showCustomizeHint = hasUserDefinedFields(photoStyleSettings)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <InviteDashboardHeader
        token={token}
        title=""
        teamName={inviteData.teamName}
        creditsRemaining={stats.creditsRemaining}
        photosAffordable={photosAffordable}
        showBackToDashboard={(showStartFlow || showGenerationFlow || !!uploadKey)}
        onBackClick={() => {
          // Reset all flow states when going back to dashboard
          setShowStartFlow(false)
          setShowGenerationFlow(false)
          setShowStyleSelection(false)
          setUploadKey('')
          setIsApproved(false)
          setGenerationType(null)
          router.replace(`/invite-dashboard/${token}`)
        }}
      />
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
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Selfie: {availableSelfies.length > 0 || uploadKey ? 'Uploaded' : 'Not uploaded'}</span>
                    </div>
          )}

                    {!showStartFlow && !uploadKey && (
           <Grid cols={{ mobile: 1, desktop: 2 }} gap="lg">
                        {/* Primary CTA - Prominent Generate Button */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="hidden md:block text-lg md:text-xl font-semibold text-gray-900 mb-2">{t('getStarted.title')}</h3>
              <p className="hidden md:block text-sm text-gray-600 mb-4">{t('getStarted.description')}</p>
              <div className="space-y-3">
                {/* Sticky wrapper for mobile */}
                <div className="md:static sticky bottom-0 md:bottom-auto z-10 bg-white md:bg-transparent pt-4 md:pt-0 pb-4 md:pb-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none -mx-6 md:mx-0 px-6 md:px-0">
                  <button 
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('fromGeneration', 'true')
                        sessionStorage.setItem('openStartFlow', 'true')
                      }
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
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
                        if (typeof window !== 'undefined') {
                          sessionStorage.removeItem('fromGeneration')
                          sessionStorage.removeItem('openStartFlow')
                        }
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

          {/* Guided start flow: inline selfie upload + proceed */}
          {showStartFlow && (
            <div className="space-y-6">
              {/* Inline selfie uploader */}
              {!showStyleSelection && !uploadKey && availableSelfies.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {/* Desktop: Title and continue button */}
                  <div className="hidden md:flex items-center justify-between mb-3">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900">{t('selfieSelection.title')}</h3>
                    <button
                      onClick={() => {
                        if (validSelectedIds.length >= 2) {
                          setShowStyleSelection(true)
                        }
                      }}
                      disabled={validSelectedIds.length < 2}
                      className="px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold shadow-md"
                    >
                      {t('common.continue')}
                    </button>
                  </div>
                  {/* Mobile: Info banner and continue button on same line */}
                  <div className="md:hidden flex items-center justify-between gap-3 mb-4">
                    <SelfieSelectionInfoBanner selectedCount={validSelectedIds.length} className="flex-1 mb-0" />
                    <button
                      onClick={() => {
                        if (validSelectedIds.length >= 2) {
                          setShowStyleSelection(true)
                        }
                      }}
                      disabled={validSelectedIds.length < 2}
                      className="px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold shadow-md flex-shrink-0"
                    >
                      {t('common.continue')}
                    </button>
                  </div>
                  {/* Desktop: Info banner */}
                  <SelfieSelectionInfoBanner selectedCount={validSelectedIds.length} className="hidden md:block mb-4" />
                  <SelfieSelectionGrid
                    selfies={availableSelfies}
                    selectedSet={selectedSet}
                    onToggle={toggleSelect}
                    showUploadTile
                    onUploadClick={() => router.push(`/invite-dashboard/${token}/selfies`) }
                  />
                  {/* Bottom buttons removed; upload tile in grid handles uploads */}
                </div>
                )}
              {!uploadKey && availableSelfies.length === 0 && (
                <SelfieUploadFlow
                  hideHeader={true}
                  onSelfiesApproved={async (results) => {
                    if (results.length === 0) return
                    const { key, selfieId } = results[0]
                    setUploadKey(key)
                    setIsApproved(true)
                    setGenerationType('team')
                    
                    // Automatically select the newly uploaded selfie
                    if (selfieId) {
                      try {
                        await toggleSelect(selfieId, true)
                        // Wait a moment for the selection to persist
                        await new Promise(resolve => setTimeout(resolve, 200))
                        // Reload selected list and available selfies to ensure they're up to date
                        await loadSelected()
                        await fetchAvailableSelfies()
                      } catch (error) {
                        console.error('Error selecting newly uploaded selfie:', error)
                        // Don't throw - continue with the flow even if selection fails
                      }
                    } else {
                      // If no selfieId provided, try to find it by fetching selfies
                      // This is a fallback for cases where selfieId isn't available
                      try {
                        await fetchAvailableSelfies()
                        await loadSelected()
                        // The selfie should be in the list now, try to find and select it
                        const updatedSelfies = await fetch(`/api/team/member/selfies?token=${token}`, {
                          credentials: 'include'
                        }).then(r => r.json()).then(d => d.selfies || [])
                        const newSelfie = updatedSelfies.find((s: Selfie) => s.key === key)
                        if (newSelfie) {
                          await toggleSelect(newSelfie.id, true)
                          await loadSelected()
                        }
                      } catch (error) {
                        console.error('Error finding and selecting selfie:', error)
                      }
                    }
                  }}
                  onCancel={() => setShowStartFlow(false)}
                  onError={() => {}}
                  onRetake={() => {
                    setUploadKey('')
                    setIsApproved(false)
                  }}
                  uploadEndpoint={async (file: File) => {
                    const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
                    const res = await fetch(`/api/uploads/proxy?token=${encodeURIComponent(token)}`, {
                      method: 'POST',
                      headers: {
                        'x-file-content-type': file.type,
                        'x-file-extension': ext,
                        'x-file-type': 'selfie'
                      },
                      body: file,
                      credentials: 'include'
                    })
                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({}))
                      throw new Error(errorData.error || 'Upload failed')
                    }
                    const { key } = await res.json() as { key: string }
                    // Provide a local preview url for UX
                    const preview = URL.createObjectURL(file)
                    return { key, url: preview }
                  }}
                  saveEndpoint={async (key: string) => {
                    const response = await fetch('/api/team/member/selfies', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token, selfieKey: key })
                    })
                    if (!response.ok) {
                      throw new Error('Failed to save selfie')
                    }
                    const data = await response.json() as { selfie?: { id: string } }
                    // Return selfie ID so useSelfieUpload can pass it to onSuccess
                    return data.selfie?.id
                  }}
                />
              )}

              {/* Style selection view (after Continue is clicked) */}
              {showStyleSelection && (
                <div className="md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:p-6 pb-24 md:pb-6">
                  <h1 className="hidden md:block text-2xl md:text-3xl font-bold text-gray-900 mb-4 font-display">{t('styleSelection.readyToGenerate')}</h1>
                  
                  {/* Mobile: Orange heads-up banner first, then style settings, then cost and generate button */}
                  <div className="md:hidden space-y-6">
                    {showCustomizeHint && (
                      <div
                        role="note"
                        className="w-full flex items-start gap-3 rounded-md border border-brand-cta/40 bg-brand-cta-light p-3"
                      >
                        <SparklesIcon className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <p className="text-[13px] leading-snug text-text-body">
                          <span className="font-medium text-brand-primary">{t('styleSelection.customizeHint.headsUp')}:</span> {t('styleSelection.customizeHint.message')}
                        </p>
                      </div>
                    )}
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
                  
                  {/* Fixed sticky button at bottom - Mobile */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white pt-4 pb-4 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <GenerateButton
                      onClick={onProceed}
                      disabled={!canGenerate}
                      isGenerating={isGenerating}
                      size="md"
                      disabledReason={!allCustomizableSectionsCustomized ? t('alerts.customizePhoto', { default: 'Please customize your photo settings before generating' }) : undefined}
                    >
                      {t('styleSelection.generateButton')}
                    </GenerateButton>
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
                          showCustomizeHint={showCustomizeHint}
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
                          disabledReason={!allCustomizableSectionsCustomized ? t('alerts.customizePhoto', { default: 'Please customize your photo settings before generating' }) : undefined}
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
                  />
                </div>
              )}
            </div>
          )}

          {/* Upload Flow (hidden when start flow is active) */}
          {uploadKey && !showStartFlow && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {!isApproved ? (
                <SelfieApproval
                  uploadedPhotoKey={uploadKey}
                  onApprove={onApprove}
                  onRetake={onRetake}
                  onCancel={() => {
                    setUploadKey('')
                    setIsApproved(false)
                  }}
                />
              ) : (
                <div className="space-y-6">
                  {/* Selfie Preview + Summary/Action side by side */}
                  {uploadKey && (
                    <Grid cols={{ mobile: 1, desktop: 2 }} gap="lg" className="items-start">
                      <SelectedSelfiePreview
                        url={availableSelfies.find(selfie => selfie.key === uploadKey)?.url || ''}
                      />
                      <GenerationSummaryTeam
                        type="team"
                        styleLabel={photoStyleSettings?.style?.preset || packageId}
                        remainingCredits={stats.creditsRemaining}
                        perGenCredits={PRICING_CONFIG.credits.perGeneration}
                        onGenerate={onProceed}
                        showCustomizeHint={showCustomizeHint}
                        teamName={inviteData.teamName}
                      />
                    </Grid>
                  )}

                  {/* Ensure style panel is visible in fallback flow */}
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
                  />

                </div>
              )}
            </div>
          )}

          {/* Generation Flow */}
          {showGenerationFlow && (
            <Panel title={t('generationFlow.title')} onClose={() => setShowGenerationFlow(false)}>
              {availableSelfies.length === 0 ? (
                <div className="text-center py-8">
                  <CameraIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">{t('generationFlow.noSelfies.title')}</h4>
                  <p className="text-sm text-gray-600 mb-4">{t('generationFlow.noSelfies.description')}</p>
                  <button
                    onClick={() => {
                      setShowGenerationFlow(false)
                      sessionStorage.setItem('fromGeneration', 'true')
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm font-medium"
                  >
                    {t('generationFlow.noSelfies.uploadButton')}
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('generationFlow.chooseSelfie')}</h4>
                  <Grid cols={{ mobile: 2, tablet: 3 }} gap="md" className="mb-6">
                    {availableSelfies.map((selfie) => (
                      <div
                        key={selfie.id}
                        onClick={() => setSelectedSelfie(selfie.key)}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 h-32 ${
                          selectedSelfie === selfie.key 
                            ? 'border-brand-primary' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Image
                          src={selfie.url}
                          alt={t('generationFlow.selfieAlt')}
                          fill
                          className="object-cover"
                        />
                        {selectedSelfie === selfie.key && (
                          <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center">
                            <CheckCircleIcon className="h-6 w-6 text-brand-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </Grid>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowGenerationFlow(false)
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('openStartFlow', 'true')
                          sessionStorage.setItem('fromGeneration', 'true')
                        }
                        router.push(`/invite-dashboard/${token}/selfies`)
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                    >
                      {t('generationFlow.uploadNewSelfie')}
                    </button>
                    <button
                      onClick={() => {
                        if (selectedSelfie) {
                          setUploadKey(selectedSelfie)
                          setIsApproved(true) // Skip validation since selfie is already approved
                          setShowGenerationFlow(false)
                          setShowStartFlow(true)
                        }
                      }}
                      disabled={!selectedSelfie || stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration}
                      className="px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold shadow-md"
                    >
                      {t('generationFlow.continueWithSelected')}
                    </button>
                  </div>
                </div>
              )}
            </Panel>
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
