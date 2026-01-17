'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { PhotoIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { Grid } from '@/components/ui'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { MIN_SELFIES_REQUIRED } from '@/constants/generation'
import { preloadFaceDetectionModel } from '@/lib/face-detection'

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
  selfiePreviewUrls?: string[]
}

/**
 * Invite dashboard page for invited users.
 *
 * This is the main landing page showing:
 * - Get Started button to begin generation flow
 * - Recent photos gallery
 * - Team info and credits
 *
 * Flow navigation is now route-based:
 * - Get Started → selfie-tips (if needs selfies) or customization-intro (if has enough)
 * - View generations → /generations
 * - Manage selfies → /selfies
 */
export default function InviteDashboardPage() {
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
  const [recentPhotoUrls, setRecentPhotoUrls] = useState<string[]>([])

  const {
    clearFlow,
    hydrated
  } = useGenerationFlowState()

  // Multi-select: load selected selfies count
  const { selectedIds, loadSelected } = useSelfieSelection({ token })

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
  }, [token, fetchDashboardData])

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
      console.error('Error fetching recent photos:', err)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      validateInvite()
      fetchRecentPhotos()
      loadSelected()
    }
  }, [token, validateInvite, fetchRecentPhotos, loadSelected])

  // Preload face detection model early so it's ready when user uploads selfies
  useEffect(() => {
    preloadFaceDetectionModel()
  }, [])

  // Navigation helper: determine initial step when starting the flow
  const handleStartFlow = useCallback(() => {
    // Clear any existing flow flags
    clearFlow()

    // Check if user has enough selfies to skip selfie upload flow
    if (selectedIds.length >= MIN_SELFIES_REQUIRED) {
      // User has enough selfies, skip directly to customization-intro
      router.push(`/invite-dashboard/${token}/customization-intro`)
    } else {
      // Not enough selfies, redirect to selfie-tips intro page
      router.push(`/invite-dashboard/${token}/selfie-tips`)
    }
  }, [clearFlow, router, token, selectedIds.length])

  // Show skeleton while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="h-14 bg-gray-200 rounded-xl animate-pulse" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <InviteDashboardHeader
        token={token}
        title=""
        teamName={inviteData.teamName}
        creditsRemaining={stats.creditsRemaining}
        photosAffordable={photosAffordable}
      />

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

          <Grid cols={{ mobile: 1, desktop: 2 }} gap="lg">
            {/* Primary CTA - Prominent Generate Button */}
            <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
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
                        clearFlow()
                        router.push(`/invite-dashboard/${token}/selfies`)
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    >
                      <div className="flex items-center justify-center gap-3">
                        {stats.selfiePreviewUrls && stats.selfiePreviewUrls.length > 0 && (
                          <div className="flex -space-x-2">
                            {stats.selfiePreviewUrls.slice(0, 3).map((url, idx) => (
                              <div
                                key={idx}
                                className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm"
                              >
                                <Image
                                  src={url}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <span>{t('getStarted.manageSelfies', { count: stats.selfiesUploaded })}</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Recent photos thumbnails */}
            <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
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
                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-brand-primary/5 via-indigo-50 to-purple-50 p-6">
                  {/* Decorative elements */}
                  <div className="absolute top-2 right-2 w-16 h-16 bg-brand-primary/10 rounded-full blur-xl" />
                  <div className="absolute bottom-2 left-2 w-12 h-12 bg-indigo-200/30 rounded-full blur-lg" />

                  <div className="relative flex flex-col items-center text-center">
                    {/* Sample headshot placeholders */}
                    <div className="flex -space-x-3 mb-3">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-white shadow-sm flex items-center justify-center"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-400/50" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-brand-primary mb-1">
                      <SparklesIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{t('recentPhotos.emptyTitle', { default: 'Your headshots will appear here' })}</span>
                    </div>
                    <p className="text-xs text-gray-500">{t('recentPhotos.emptySubtitle', { default: 'Generate your first photo to see results' })}</p>
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

          {/* Sign up CTA - Hidden on mobile */}
          <div className="hidden md:block bg-white rounded-lg shadow-md border border-gray-100 p-6 md:mt-6">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {t('signUpCta.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('signUpCta.description')}
            </p>
            <button
              onClick={() => window.location.href = 'https://www.photoshotspro.com'}
              className="px-4 py-2 text-brand-primary border-2 border-brand-primary rounded-md text-sm font-medium transition-colors hover:bg-brand-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
            >
              {t('signUpCta.button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
