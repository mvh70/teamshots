'use client'

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import GenerationCard from '../components/GenerationCard'
import { useGenerations, useGenerationFilters } from '../hooks/useGenerations'
import { useSession } from 'next-auth/react'
import { useCredits } from '@/contexts/CreditsContext'
import { BRAND_CONFIG } from '@/config/brand'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import { type PricingTier } from '@/config/pricing'
import { type PlanPeriod } from '@/domain/subscription/utils'
import { Toast } from '@/components/ui'
import { Lightbox } from '@/components/generations'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useOnbordaTours } from '@/lib/onborda/hooks'
import { useGenerationDetailTourTrigger } from '@/lib/onborda/useGenerationDetailTourTrigger'
import { useDomain } from '@/contexts/DomainContext'

export default function TeamGenerationsPage() {
  const tg = useTranslations('generations.team')
  const t = useTranslations('app.sidebar.generate')
  const { data: session } = useSession()
  const { credits: userCredits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const { isIndividualDomain } = useDomain()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isNewGeneration = searchParams.get('new_generation') === 'true'
  const [isWaitingForNewGeneration, setIsWaitingForNewGeneration] = useState(isNewGeneration)
  const [isTeamAdmin, setIsTeamAdmin] = useState(false)
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<PricingTier | null>(null)
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<PlanPeriod | null>(null)
  const currentUserId = session?.user?.id
  const currentPersonId = session?.user?.person?.id
  const currentUserName = session?.user?.name || ''
  const [failureToast, setFailureToast] = useState<string | null>(null)
  const { context: onboardingContext } = useOnboardingState()
  const { startTour } = useOnbordaTours()

  // On individual-only domains (portreya.com), redirect to personal generations
  // Team features don't exist on individual domains
  useEffect(() => {
    if (isIndividualDomain) {
      window.location.href = '/app/generations/personal'
    }
  }, [isIndividualDomain])

  // Fetch effective roles from API (respects pro subscription = team admin)
  useEffect(() => {
    const fetchRoles = async () => {
      if (!session?.user?.id) return

      try {
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setIsTeamAdmin(data.userRole?.isTeamAdmin ?? false)
        }
        setRolesLoaded(true)
      } catch (err) {
        console.error('Failed to fetch roles:', err)
        // Default to false on error
        setIsTeamAdmin(false)
        setRolesLoaded(true)
      }
    }

    fetchRoles()
  }, [session?.user?.id])
  // Initialize filter to 'team' by default for team pages (shows "All users")
  // This prevents the delay of showing "me" first, then switching to "team"
  const { timeframe, context, userFilter, selectedUserId, setTimeframe, setContext, setUserFilter, setSelectedUserId, filterGenerated } = useGenerationFilters('team')
  const filterInitializedRef = useRef(false)

  // Adjust filter based on team admin status once roles have been loaded
  // Initialize filter based on user role - intentional one-time initialization
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    // Only adjust filter once, after roles have been loaded
    if (rolesLoaded && !filterInitializedRef.current) {
      filterInitializedRef.current = true
      // If user is not an admin, restrict to their own generations
      if (isTeamAdmin === false) {
        setUserFilter('me')
      }
      // If user is an admin, keep the default 'team' (All users) - no change needed
    }
  }, [rolesLoaded, isTeamAdmin, setUserFilter])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */
  const { href: buyCreditsHref } = useBuyCreditsLink()
  const [teamView] = useState<'mine' | 'team'>('mine')
  const [viewMode, setViewMode] = useState<'images' | 'folders'>('images')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [personCounts, setPersonCounts] = useState<{ personId: string; personName: string; personUserId?: string; count: number }[]>([])
  const [countsLoading, setCountsLoading] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ src: string; personName: string } | null>(null)

  // Fetch person counts for folder view and image view headers
  useEffect(() => {
    const fetchCounts = async () => {
      setCountsLoading(true)
      try {
        const response = await fetch('/api/generations/counts')
        if (response.ok) {
          const data = await response.json()
          setPersonCounts(data.personCounts || [])
        }
      } catch (error) {
        console.error('Failed to fetch person counts:', error)
      } finally {
        setCountsLoading(false)
      }
    }

    void fetchCounts()
  }, []) // Fetch once on mount

  // Fetch subscription tier for display purposes (regeneration count, etc.)
  useEffect(() => {
    const fetchTier = async () => {
      if (!session?.user?.id) return
      try {
        const response = await fetch('/api/account/mode')
        if (response.ok) {
          const accountMode = await response.json()
          setSubscriptionTier(accountMode.subscriptionTier)
          setSubscriptionPeriod(accountMode.subscriptionPeriod)
        }
      } catch (err) {
        console.error('Failed to fetch account mode:', err)
      }
    }
    void fetchTier()
  }, [session?.user?.id])

  const handleGenerationFailed = useCallback(
    ({ errorMessage }: { id: string; errorMessage?: string }) => {
      if (errorMessage) {
        console.warn('Team generation failed', errorMessage)
      }
      setFailureToast('Generation failed')
      // Delay credit refetch to ensure backend refund transaction has completed
      setTimeout(() => {
        void refetchCredits()
      }, 2000)
    },
    [refetchCredits]
  )

  const { generated, teamUsers, pagination, loading, loadMore } = useGenerations(
    currentUserId,
    isTeamAdmin,
    currentUserName,
    currentPersonId,
    'team', // scope
    teamView, // teamView
    (isTeamAdmin && userFilter === 'team')
      ? selectedUserId
      : (isTeamAdmin && userFilter === 'me' && currentPersonId)
        ? currentPersonId
        : 'all',
    handleGenerationFailed
  )

  const filteredAndSortedGenerated = useMemo(() => {
    // First apply the standard filters (timeframe, context)
    let filtered = filterGenerated(generated)

    // If in folder view and a person is selected, filter to that person only
    if (viewMode === 'folders' && selectedPersonId) {
      filtered = filtered.filter(g => g.personId === selectedPersonId)
    }

    // Sort by person name first, then by date (newest first)
    return filtered.sort((a, b) => {
      const personA = a.personFirstName || 'Unknown'
      const personB = b.personFirstName || 'Unknown'

      // First compare by person name
      const nameCompare = personA.localeCompare(personB)
      if (nameCompare !== 0) return nameCompare

      // Then by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [generated, filterGenerated, viewMode, selectedPersonId])

  const filteredGenerated = filteredAndSortedGenerated

  // Turn off waiting when we have data
  useEffect(() => {
    if (isWaitingForNewGeneration && filteredGenerated.length > 0) {
      setIsWaitingForNewGeneration(false)
    }
  }, [filteredGenerated.length, isWaitingForNewGeneration])

  // Safety timeout
  useEffect(() => {
    if (isWaitingForNewGeneration) {
      const timer = setTimeout(() => setIsWaitingForNewGeneration(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isWaitingForNewGeneration])

  useGenerationDetailTourTrigger({
    loading,
    generations: generated,
    onboardingLoaded: !!onboardingContext._loaded,
    completedTours: onboardingContext.completedTours,
    startTour,
  })

  useEffect(() => {
    if (!failureToast) return

    const timer = window.setTimeout(() => setFailureToast(null), 6000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [failureToast])

  // Build photo style options dynamically from existing generations
  const styleOptions = useMemo(() => Array.from(new Set(
    generated.map(g => g.contextName || 'Freestyle')
  )), [generated])

  // Filter and sort generations


  // Group generations by person for image view with headers
  const groupedByPerson = useMemo(() => {
    const groups: { personId: string; personName: string; generations: typeof filteredGenerated }[] = []
    let currentGroup: typeof groups[0] | null = null

    filteredGenerated.forEach(g => {
      const personId = g.personId || 'unknown'
      const personName = g.personFirstName || 'Unknown'

      if (!currentGroup || currentGroup.personId !== personId) {
        currentGroup = { personId, personName, generations: [] }
        groups.push(currentGroup)
      }
      currentGroup.generations.push(g)
    })

    return groups
  }, [filteredGenerated])

  // Check if user has credits
  // NEW CREDIT MODEL: All usable credits are on person
  const hasCredits = userCredits.person > 0

  // Show upsell window only if no credits AND no existing generations
  // Also wait for subscriptionPeriod to be known (to correctly determine credit source)
  if (!creditsLoading && subscriptionPeriod !== null && !hasCredits && filteredGenerated.length === 0 && !loading && !isWaitingForNewGeneration) {
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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">{tg('title')}</h1>
        <p className="text-gray-600 text-base sm:text-lg font-medium leading-relaxed">{tg('description')}</p>
      </div>

      {/* Filters and Generate Button Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filters - Enhanced Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2 -mb-2 sm:pb-0 sm:mb-0">
          {/* Team members can only see their own photos - no team gallery filter needed */}
          {/* Only team admins (pro users) can see all team photos and filter by user */}

          {/* Admin User Filter - only for team admins (pro users) */}
          {isTeamAdmin && (
            <div className="relative">
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[160px]"
              >
                <option value="me">My generations</option>
                <option value="team">{tg('filters.allUsers')}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
          {isTeamAdmin && userFilter === 'team' && teamUsers.length > 0 && (
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[140px]"
              >
                <option value="all">{tg('filters.allUsers')}</option>
                {teamUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Timeframe filter - Enhanced dropdown */}
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as 'all' | '7d' | '30d')}
              className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[140px]"
            >
              <option value="all">{tg('filters.allTime')}</option>
              <option value="7d">{tg('filters.last7Days')}</option>
              <option value="30d">{tg('filters.last30Days')}</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Style filter - Enhanced dropdown */}
          {styleOptions.length > 0 && (
            <div className="relative">
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all duration-200 shadow-sm hover:shadow-md min-w-[160px]"
              >
                <option value="all">{tg('filters.allPhotoStyles')}</option>
                {styleOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <button
              onClick={() => {
                setViewMode('images')
                setSelectedPersonId(null)
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${viewMode === 'images'
                ? 'bg-brand-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Images
            </button>
            <button
              onClick={() => {
                setViewMode('folders')
                setSelectedPersonId(null)
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${viewMode === 'folders'
                ? 'bg-brand-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Folders
            </button>
          </div>
        </div>

      </div>

      {/* Team Gallery Info */}
      {teamView === 'team' && !isTeamAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">{tg('viewOnly')}</p>
        </div>
      )}

      {/* Content */}
      {viewMode === 'folders' && !selectedPersonId ? (
        // Folder View - Show person folders with counts from API
        countsLoading || loading || isWaitingForNewGeneration ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
        ) : personCounts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {personCounts.sort((a, b) => a.personName.localeCompare(b.personName)).map(folder => (
              <button
                key={folder.personId}
                onDoubleClick={() => setSelectedPersonId(folder.personId)}
                onClick={() => setSelectedPersonId(folder.personId)}
                className="group bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-brand-primary hover:shadow-lg transition-all duration-200 cursor-pointer text-left"
              >
                {/* Folder Icon */}
                <div className="mb-3 flex justify-center">
                  <div className="relative">
                    <svg className="w-16 h-16 text-brand-primary group-hover:scale-105 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                    </svg>
                    {/* Photo count badge */}
                    <span className="absolute -top-1 -right-1 bg-brand-secondary text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                      {folder.count}
                    </span>
                  </div>
                </div>
                {/* Person Name */}
                <p className="text-sm font-medium text-gray-900 text-center truncate">
                  {folder.personName}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border">
            <p className="text-gray-700 mb-2">{tg('empty.title')}</p>
            <p className="text-gray-500 text-sm mb-4">{tg('empty.subtitle')}</p>
            <Link href="/app/generate/start?type=team" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">{tg('newGeneration')}</Link>
          </div>
        )
      ) : (
        // Image View (or folder view with selected person)
        <>
          {/* Back button when viewing a person's folder */}
          {viewMode === 'folders' && selectedPersonId && (
            <div className="mb-4">
              <button
                onClick={() => setSelectedPersonId(null)}
                className="flex items-center gap-2 text-brand-primary hover:text-brand-primary-hover font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to folders
              </button>
              <h2 className="text-xl font-semibold text-gray-900 mt-2">
                {personCounts.find(f => f.personId === selectedPersonId)?.personName || 'Unknown'}&apos;s photos
              </h2>
            </div>
          )}

          {filteredGenerated.length > 0 ? (
            <>
              {/* Images grouped by person with headers */}
              <div className="space-y-8">
                {groupedByPerson.map(group => (
                  <div key={group.personId}>
                    {/* Person header */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                      {group.personName}&apos;s photos
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({personCounts.find(p => p.personId === group.personId)?.count ?? group.generations.length})
                      </span>
                    </h3>
                    {/* Person's images grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                      {group.generations.map(item => (
                        <GenerationCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          onImageClick={(src) => setLightboxImage({ src, personName: group.personName })}
                        />
                      ))}
                    </div>
                  </div>
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
            (loading || isWaitingForNewGeneration) ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border">
                <p className="text-gray-700 mb-2">{tg('empty.title')}</p>
                <p className="text-gray-500 text-sm mb-4">{tg('empty.subtitle')}</p>
                <Link href="/app/generate/start?type=team" className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">{tg('newGeneration')}</Link>
              </div>
            )
          )}
        </>
      )}

      {failureToast && (
        <Toast
          message={failureToast}
          type="error"
          onDismiss={() => setFailureToast(null)}
        />
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <Lightbox
          src={lightboxImage.src}
          alt={`${lightboxImage.personName}'s photo`}
          label={`${lightboxImage.personName}'s photo`}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  )
}
