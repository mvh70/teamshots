'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import GenerationCard from '../components/GenerationCard'
import { useGenerations, useGenerationFilters } from '../hooks/useGenerations'
import { useSession } from 'next-auth/react'
import { useCredits } from '@/contexts/CreditsContext'
import { BRAND_CONFIG } from '@/config/brand'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import { PRICING_CONFIG } from '@/config/pricing'
import { Toast } from '@/components/ui'

export default function TeamGenerationsPage() {
  const tg = useTranslations('generations.team')
  const t = useTranslations('app.sidebar.generate')
  const toastMessages = useTranslations('generations.toasts')
  const { data: session } = useSession()
  const { credits: userCredits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const [isTeamAdmin, setIsTeamAdmin] = useState(false)
  const currentUserId = session?.user?.id
  const currentUserName = session?.user?.name || ''
  const [failureToast, setFailureToast] = useState<string | null>(null)

  // Fetch effective roles from API (respects pro subscription = team admin)
  useEffect(() => {
    const fetchRoles = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/dashboard/stats')
          if (response.ok) {
            const data = await response.json()
            setIsTeamAdmin(data.userRole?.isTeamAdmin ?? false)
          }
        } catch (err) {
          console.error('Failed to fetch roles:', err)
        }
      }
    }
    fetchRoles()
  }, [session?.user?.id])
  const { timeframe, context, userFilter, selectedUserId, setTimeframe, setContext, setUserFilter, setSelectedUserId, filterGenerated } = useGenerationFilters()
  const { href: buyCreditsHref } = useBuyCreditsLink()
  const [teamView] = useState<'mine' | 'team'>('mine')
  const handleGenerationFailed = useCallback(
    ({ errorMessage }: { id: string; errorMessage?: string }) => {
      if (errorMessage) {
        console.warn('Team generation failed', errorMessage)
      }
      setFailureToast(toastMessages('generationFailed'))
      void refetchCredits()
    },
    [toastMessages, refetchCredits]
  )

  const { generated, teamUsers, pagination, loading, loadMore } = useGenerations(
    currentUserId,
    isTeamAdmin,
    currentUserName,
    'team', // scope
    teamView, // teamView
    (isTeamAdmin && userFilter === 'team') ? selectedUserId : 'all',
    handleGenerationFailed
  )

  useEffect(() => {
    if (!failureToast) return

    const timer = window.setTimeout(() => setFailureToast(null), 6000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [failureToast])

  const filteredGenerated = filterGenerated(generated)
  // Build photo style options dynamically from existing generations
  const styleOptions = Array.from(new Set(
    generated.map(g => g.contextName || 'Freestyle')
  ))

  // Check if user has team credits
  const hasTeamCredits = userCredits.team > 0

  // Show upsell window only if no team credits AND no existing generations
  if (!creditsLoading && !hasTeamCredits && filteredGenerated.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {isTeamAdmin ? t('noCreditsTitle') : t('noTeamCreditsTitle')}
            </h1>
            <p className="text-gray-600 mb-6">
              {isTeamAdmin ? t('noCreditsMessage') : t('noTeamCreditsMessage')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isTeamAdmin ? (
                <>
                  <Link
                    href={buyCreditsHref}
                    className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                    style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
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
                </>
              ) : (
                <>
                  <Link
                    href="/app/dashboard"
                    className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                    style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                    }}
                  >
                    {t('requestCredits')}
                  </Link>
                  <Link
                    href="/app/generations/personal"
                    className="px-6 py-3 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    {t('usePersonalCredits')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{tg('title')}</h1>
                <Link href="/app/generate/selfie?type=team" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">New generation</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
          {/* Team members can only see their own photos - no team gallery filter needed */}
          {/* Only team admins (pro users) can see all team photos and filter by user */}

          {/* Admin User Filter - only for team admins (pro users) */}
          {isTeamAdmin && (
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
              <option value="me">My generations</option>
              <option value="team">{tg('filters.allUsers')}</option>
            </select>
          )}
          {isTeamAdmin && userFilter === 'team' && (
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
              <option value="all">All users</option>
              {teamUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as 'all'|'7d'|'30d')} className="border rounded-md px-2 py-1 text-sm">
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select value={context} onChange={(e) => setContext(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
            <option value="all">All photo styles</option>
            {styleOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="ml-auto text-xs text-gray-600">{PRICING_CONFIG.credits.perGeneration} credits per generation</div>
        </div>

      {/* Team Gallery Info */}
      {teamView === 'team' && !isTeamAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">{tg('viewOnly')}</p>
        </div>
      )}

      {/* Content */}
      {filteredGenerated.length ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGenerated.map(item => (
                <GenerationCard key={item.id} item={item} currentUserId={currentUserId} />
              ))}
            </div>
            
            {/* Load More Button */}
            {pagination?.hasNextPage && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : `Load More (${pagination.totalCount - filteredGenerated.length} remaining)`}
                </button>
              </div>
            )}
            
            {/* Pagination Info */}
            {pagination && (
              <div className="text-center text-sm text-gray-600 mt-4">
                Showing {filteredGenerated.length} of {pagination.totalCount} generations
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border">
            <p className="text-gray-700 mb-2">{tg('empty.title')}</p>
            <p className="text-gray-500 text-sm mb-4">{tg('empty.subtitle')}</p>
                <Link href="/app/generate/selfie?type=team" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">New generation</Link>
          </div>
        )}
      {failureToast && (
        <Toast
          message={failureToast}
          type="error"
          onDismiss={() => setFailureToast(null)}
        />
      )}
    </div>
  )
}
