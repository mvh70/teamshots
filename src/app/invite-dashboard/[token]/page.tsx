'use client'

import { useParams } from 'next/navigation'
import { useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { PhotoIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import FlowPageSkeleton from '@/components/generation/loading/FlowPageSkeleton'
import { Grid } from '@/components/ui'
import InviteDashboardHeader from '@/components/invite/InviteDashboardHeader'
import SignUpCTA from '@/components/invite/SignUpCTA'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { preloadFaceDetectionModel } from '@/lib/face-detection'
import { useInviteStats } from '@/hooks/useInviteStats'
import { isRecord } from '@/lib/type-guards'
import { useInviteFlowNavigation } from '@/hooks/useInviteFlowNavigation'
import type { InviteDashboardStats } from '@/types/invite'
import { useSWR } from '@/lib/swr'

/**
 * Invite dashboard page for invited users.
 *
 * This is the main landing page showing:
 * - Get Started button to begin generation flow
 * - Recent photos gallery
 * - Team info and credits
 *
 * Flow navigation is now route-based:
 * - Get Started → selfie-tips (if needs selfies) or beautification (if has enough)
 * - View generations → /generations
 * - Manage selfies → /selfies
 */
export default function InviteDashboardPage() {
  const params = useParams<{ token: string }>()
  const t = useTranslations('inviteDashboard')
  const token = params?.token
  const safeToken = token || ''

  const navigation = useInviteFlowNavigation(safeToken)
  const { stats, loading: statsLoading } = useInviteStats<InviteDashboardStats>(safeToken, {
    initialStats: {
      photosGenerated: 0,
      creditsRemaining: 0,
      selfiesUploaded: 0,
      teamPhotosGenerated: 0,
    },
  })

  const {
    clearFlow,
    hydrated
  } = useGenerationFlowState({ flowScope: safeToken })

  // Multi-select: load selected selfies count
  const { selectedIds } = useSelfieSelection({ token: safeToken })

  const { data: recentPhotoUrls = [], isLoading: recentPhotosLoading } = useSWR<string[]>(
    token ? `/api/team/member/generations?token=${safeToken}` : null,
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) return []
      const data = await response.json()
      const generations = isRecord(data) && Array.isArray((data as { generations?: unknown }).generations)
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

      return urls
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  // Preload face detection model early so it's ready when user uploads selfies
  useEffect(() => {
    preloadFaceDetectionModel()
  }, [])

  // Navigation helper: determine initial step when starting the flow
  const handleStartFlow = useCallback(() => {
    // Clear any existing flow flags
    clearFlow()
    navigation.startFlow(selectedIds)
  }, [clearFlow, navigation, selectedIds])

  if (!token) {
    return null
  }

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

  if (statsLoading || recentPhotosLoading) {
    return <FlowPageSkeleton variant="centered-spinner" loadingLabel={t('loading')} />
  }

  const photosAffordable = calculatePhotosFromCredits(stats.creditsRemaining)

  return (
    <div className="min-h-screen bg-gray-50">
      <InviteDashboardHeader
        token={token}
        title=""
        teamName={stats.teamName}
        creditsRemaining={stats.creditsRemaining}
        photosAffordable={photosAffordable}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Insufficient credits warning */}
          {stats.creditsRemaining < PRICING_CONFIG.credits.perGeneration && (
            <div data-testid="insufficient-credits-banner" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
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
                    data-testid="get-started-btn"
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
                      onClick={navigation.toGenerations}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900"
                    >
                      {t('getStarted.viewTeamPhotos', { count: stats.teamPhotosGenerated })}
                    </button>
                  )}
                  {stats.selfiesUploaded > 0 && (
                    <button
                      onClick={() => {
                        clearFlow()
                        navigation.toSelfies()
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
                  onClick={navigation.toGenerations}
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

          <SignUpCTA className="md:mt-6" />
        </div>
      </div>
    </div>
  )
}
