'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { 
  PhotoIcon, 
  CheckCircleIcon,
  CameraIcon,
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
import { hasUserDefinedFields } from '@/domain/style/userChoice'
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
        context?: { id: string; settings?: Record<string, unknown>; stylePreset?: string }
        packageId?: string
      }

      if (!data.context) {
        throw new Error('No context found')
      }

      // Extract packageId from API response or context settings
      const extractedPackageId = data.packageId || (data.context.settings as Record<string, unknown>)?.['packageId'] as string || 'headshot1'
      
      // Load the package config and deserialize settings
      const pkg = getPackageConfig(extractedPackageId)
      const ui: PhotoStyleSettingsType = data.context.settings 
        ? pkg.persistenceAdapter.deserialize(data.context.settings as Record<string, unknown>)
        : pkg.defaultSettings
      
      setPhotoStyleSettings(ui)
      setOriginalContextSettings(ui)
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
  useEffect(() => {
    const pendingGeneration = sessionStorage.getItem('pendingGeneration')
    if (pendingGeneration === 'true' && availableSelfies.length > 0 && !uploadKey) {
      // Use the most recent selfie (first in the array)
      const latestSelfie = availableSelfies[0]
      if (latestSelfie) {
        setUploadKey(latestSelfie.key)
        setIsApproved(true)
        setGenerationType('team')
        sessionStorage.removeItem('pendingGeneration')
      }
    }
  }, [availableSelfies, uploadKey])

  const onApprove = () => {
    setIsApproved(true)
    // For team members, automatically set to team type
    setGenerationType('team')
  }

  const onReject = async () => {
    await deleteSelfie()
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

  const onProceed = async () => {
    // Require at least 2 selfies for generation
    if (validSelectedIds.length < 2) {
      alert('Please select at least 2 selfies to continue.')
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
        selfieIds: validSelectedIds
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
        // Redirect to generations page to see the result
        router.push(`/invite-dashboard/${token}/generations`)
      } else {
        const error = await response.json()
        console.error('Generation failed:', error)
        alert('Failed to start generation. Please try again.')
        setIsGenerating(false)
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      alert('Failed to start generation. Please try again.')
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
          <p className="mt-2 text-sm text-gray-600">Loading dashboard...</p>
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
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Invalid Invite</h1>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push(`/${locale}`)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              Go to Homepage
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
        showBackToDashboard={(showStartFlow || showGenerationFlow || !!uploadKey)}
        right={(
          <div className="text-right">
            <p className="text-sm text-gray-500">Credits</p>
            <p className="text-2xl font-bold text-brand-primary">{stats.creditsRemaining}</p>
            <p className="text-xs text-gray-500 mt-1">Good for {photosAffordable} photo{photosAffordable === 1 ? '' : 's'}</p>
          </div>
        )}
      />
      {/* Invite dashboard does not show selected selfies or a Generate button.
          Actions live in Selfies and Generations pages. */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
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
                        {/* Primary CTA and secondary links */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Get started</h3>
              <p className="text-sm text-gray-600 mb-4">We&#39;ll guide you through uploading your selfie and generating your team photo.</p>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    router.push(`/invite-dashboard/${token}/selfies`)
                  }}
                  className="w-full flex items-center justify-center px-4 py-4 border border-brand-primary bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                >
                  <PhotoIcon className="h-6 w-6 mr-3" />
                  <span className="text-sm font-medium">Start your team photo</span>
                </button>
                <div className="flex gap-3">
                  {stats.teamPhotosGenerated > 0 && (
                    <button 
                      onClick={() => router.push(`/invite-dashboard/${token}/generations`)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    > 
                      View team photos ({stats.teamPhotosGenerated})
                    </button>
                  )}
                  {stats.selfiesUploaded > 0 && (
                  <button 
                      onClick={() => router.push(`/invite-dashboard/${token}/selfies`)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    > 
                      Manage my selfies ({stats.selfiesUploaded})
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Recent photos thumbnails */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900">Recent photos</h3>
                <button
                  onClick={() => router.push(`/invite-dashboard/${token}/generations`)}
                  className="text-sm text-brand-primary hover:text-brand-primary-hover"
                >
                  View all
                </button>
              </div>
              {recentPhotoUrls.length === 0 ? (
                <div className="flex items-center justify-center h-28 text-center text-sm text-gray-600 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <PhotoIcon className="h-5 w-5 text-gray-400" />
                    <span>No photos yet. Generate one and they&#39;ll show up here.</span>
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Choose selfies to use</h3>
                    <button
                      onClick={() => {
                        if (validSelectedIds.length >= 2) {
                          setShowStyleSelection(true)
                        }
                      }}
                      disabled={validSelectedIds.length < 2}
                      className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Continue
                    </button>
                  </div>
                  <SelfieSelectionInfoBanner selectedCount={validSelectedIds.length} className="mb-4" />
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
                  onSelfieApproved={async (key, selfieId) => {
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
                <div className="bg-white rounded-xl md:rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
                  <h1 className="text-2xl md:text-xl font-semibold text-gray-900 mb-5 md:mb-4">Ready to Generate</h1>
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
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
                          <div className="text-sm text-gray-600 md:text-right">Cost per generation</div>
                          <div className="text-3xl md:text-2xl font-bold text-gray-900">{PRICING_CONFIG.credits.perGeneration} credits</div>
                        </div>
                      </div>
                      <div className="mt-4 md:mt-4">
                        <GenerateButton
                          onClick={onProceed}
                          disabled={validSelectedIds.length < 2 || stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration}
                          isGenerating={isGenerating}
                          size="md"
                        >
                          Generate Team Photos
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
                    className="mt-6 pt-6 border-t border-gray-200"
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
                  onReject={onReject}
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
                  />

                </div>
              )}
            </div>
          )}

          {/* Generation Flow */}
          {showGenerationFlow && (
            <Panel title="Generate Team Photos" onClose={() => setShowGenerationFlow(false)}>
              {availableSelfies.length === 0 ? (
                <div className="text-center py-8">
                  <CameraIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No selfies uploaded yet</h4>
                  <p className="text-sm text-gray-600 mb-4">Upload a selfie first to generate team photos.</p>
                  <button
                    onClick={() => {
                      setShowGenerationFlow(false)
                      sessionStorage.setItem('fromGeneration', 'true')
                      router.push(`/invite-dashboard/${token}/selfies`)
                    }}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 text-sm font-medium"
                  >
                    Upload Selfie
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Choose a selfie to use:</h4>
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
                          alt="Selfie"
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
                      Upload New Selfie
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
                      disabled={!selectedSelfie}
                      className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Continue with Selected Selfie
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* Sign up CTA */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Want to create personal photos too?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Sign up for a personal account to generate photos with full creative control.
            </p>
            <button
              onClick={() => router.push('/auth/signup')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
            >
              Sign Up for Personal Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
