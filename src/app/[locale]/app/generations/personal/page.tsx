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

export default function PersonalGenerationsPage() {
  const tg = useTranslations('generations.personal')
  const t = useTranslations('app.sidebar.generate')
  const toastMessages = useTranslations('generations.toasts')
  const { data: session } = useSession()
  const { credits: userCredits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const currentUserId = session?.user?.id
  const currentUserName = session?.user?.name || ''
  const [failureToast, setFailureToast] = useState<string | null>(null)
  const { timeframe, context, setTimeframe, setContext, filterGenerated } = useGenerationFilters()
  const { href: buyCreditsHref } = useBuyCreditsLink()
  // If the user is in a team context (admin or member), they should not access personal generations – redirect to team
  useEffect(() => {
    const redirectIfTeamAdmin = async () => {
      try {
        // Quick client check for team membership
        if (session?.user?.person?.teamId) {
          window.location.href = '/app/generations/team'
          return
        }
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          if (data.userRole?.isTeamAdmin) {
            window.location.href = '/app/generations/team'
          }
        }
      } catch (err) {
        // Silent fail; if stats endpoint fails, keep current behavior
      }
    }
    // Only check once we have (or likely have) a session
    if (session?.user?.id) {
      void redirectIfTeamAdmin()
    }
  }, [session?.user?.id])
  const handleGenerationFailed = useCallback(
    ({ errorMessage }: { id: string; errorMessage?: string }) => {
      if (errorMessage) {
        console.warn('Generation failed', errorMessage)
      }
      setFailureToast(toastMessages('generationFailed'))
      void refetchCredits()
    },
    [toastMessages, refetchCredits]
  )

  const { generated, pagination, loading, loadMore } = useGenerations(
    currentUserId,
    false, // isTeamAdmin - not needed for personal
    currentUserName,
    undefined, // currentPersonId - not needed for personal
    'personal', // scope
    undefined, // teamView - not needed for personal
    'all', // selectedUserId - not needed for personal
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

  // Check if user has individual credits
  const hasIndividualCredits = userCredits.individual > 0

  // Show upsell window only if no individual credits AND no existing generations
  if (!creditsLoading && !hasIndividualCredits && filteredGenerated.length === 0 && !loading) {
    return (
      <div className="space-y-6">
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
                <Link href="/app/generate/selfie?type=personal" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">New generation</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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

      {/* Content */}
      {filteredGenerated.length ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGenerated.map(item => (
                <GenerationCard key={item.id} item={item} />
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
                <Link href="/app/generate/selfie?type=personal" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">New generation</Link>
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
