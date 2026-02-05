'use client'

import { useSession } from 'next-auth/react'
import {
  UsersIcon,
  PhotoIcon,
  DocumentTextIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import {useTranslations} from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { jsonFetcher } from '@/lib/fetcher'
import { useCredits } from '@/contexts/CreditsContext'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { useOnboardingState } from '@/contexts/OnboardingContext'
import { useAnalytics } from '@/hooks/useAnalytics'
import { FeedbackButton } from '@/components/feedback/FeedbackButton'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useDomain } from '@/contexts/DomainContext'

const SelfieUploadFlow = dynamic(() => import('@/components/Upload/SelfieUploadFlow'), { ssr: false })

interface DashboardStats {
  photosGenerated: number
  activeTemplates: number
  creditsUsed: number
  teamMembers: number
}

interface UserPermissions {
  isTeamAdmin: boolean
  isTeamMember: boolean
  isRegularUser: boolean
  teamId?: string
  isFirstVisit?: boolean
  isSeatsBasedTeam?: boolean
}

interface Activity {
  id: string
  type: string
  user: string
  action: string
  time: string
  status: string
  isOwn?: boolean
  generationType?: 'personal' | 'team'
}

interface PendingInvite {
  id: string
  email: string
  name: string
  sent: string
  status: string
}



const normalizeUserPermissions = (
  permissions?: Partial<UserPermissions> | null
): UserPermissions => ({
  isTeamAdmin: permissions?.isTeamAdmin ?? false,
  isTeamMember: permissions?.isTeamMember ?? false,
  isRegularUser: permissions?.isRegularUser ?? true,
  teamId: permissions?.teamId,
  isFirstVisit: permissions?.isFirstVisit,
  isSeatsBasedTeam: permissions?.isSeatsBasedTeam ?? false,
})

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const t = useTranslations('app.dashboard')
  const { credits, loading: creditsLoading } = useCredits()
  const { isFreePlan } = usePlanInfo()
  const { resetFlow } = useGenerationFlowState()
  const firstName = (session?.user?.name?.split(' ')[0]) || (session?.user?.name || '') || (session?.user?.email?.split('@')[0]) || 'User'

  const [stats, setStats] = useState<DashboardStats>({
    photosGenerated: 0,
    activeTemplates: 0,
    creditsUsed: 0,
    teamMembers: 0
  })
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(normalizeUserPermissions())
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])

  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(() => 
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success') === 'true'
  )
  const urlCleanedRef = useRef(false)
  const [showUploadFlow, setShowUploadFlow] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Use server-authoritative brand name from DomainContext
  const { brandName, isIndividualDomain } = useDomain()

  // Compute success message from URL params (derived during render, not in effect)
  const successMessage = useMemo(() => {
    const successParam = searchParams.get('success')
    if (successParam !== 'true') return ''
    
    const messageType = searchParams.get('type')
    switch (messageType) {
      case 'individual_success':
        return t('successMessages.individual', { credits: PRICING_CONFIG.individual.credits })
      case 'vip_success':
        return t('successMessages.vip', { credits: PRICING_CONFIG.vip.credits })
      case 'seats_success':
        return t('successMessages.seats')
      case 'top_up_success':
        return t('successMessages.topUp')
      default:
        return t('successMessages.default')
    }
  }, [searchParams, t])

  // Onboarding state
  const { context: onboardingContext, updateContext: updateOnboardingContext } = useOnboardingState()
  const { track } = useAnalytics()
  const [hasCompletedMainOnboarding, setHasCompletedMainOnboarding] = useState(false) // Start as false, will be set to true if completed
  const [showOnboardingImmediately, setShowOnboardingImmediately] = useState(false)
  const [onboardingStartedTracked, setOnboardingStartedTracked] = useState(false)
  
  // Check for transition flag immediately on mount.
  // This reads from sessionStorage (client-only) to determine onboarding state from signup flow.
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const showImmediately = sessionStorage.getItem('show-onboarding-immediately') === 'true'
      if (showImmediately) {
        // Clear flag immediately to prevent stale state
        sessionStorage.removeItem('show-onboarding-immediately')
        // Set flag to show onboarding immediately once context is loaded
        setShowOnboardingImmediately(true)
        // Ensure onboarding is not marked as completed
        setHasCompletedMainOnboarding(false)
      }

      // Prevent any automatic redirects to photo styles page after team creation
      // Users should complete onboarding first, then navigate when ready
      const preventRedirect = sessionStorage.getItem('prevent-style-redirect')
      if (preventRedirect !== 'true') {
        sessionStorage.setItem('prevent-style-redirect', 'true')
      }
    }
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */
  
  const shouldShowOnboarding = !hasCompletedMainOnboarding && onboardingContext._loaded

  // Don't show onboarding during initial server render to prevent hydration mismatch
  const showOnboardingSection = mounted && shouldShowOnboarding

  // Track onboarding funnel analytics
  useEffect(() => {
    if (showOnboardingSection && !onboardingStartedTracked && session?.user?.id) {
      // Track onboarding started (first time user sees onboarding)
      track('onboarding_started', {
        user_id: session.user.id,
        onboarding_segment: onboardingContext.onboardingSegment,
        is_free_plan: onboardingContext.isFreePlan,
        total_steps: 1
      })
      setOnboardingStartedTracked(true)
    }
  }, [showOnboardingSection, onboardingStartedTracked, session?.user?.id, onboardingContext.onboardingSegment, onboardingContext.isFreePlan, track])

  // Track step views
  useEffect(() => {
    if (showOnboardingSection && session?.user?.id) {
      track('onboarding_step_viewed', {
        user_id: session.user.id,
      step_number: 1,
      step_name: 'how_it_works',
        onboarding_segment: onboardingContext.onboardingSegment,
        is_free_plan: onboardingContext.isFreePlan
      })
    }
}, [showOnboardingSection, session?.user?.id, onboardingContext.onboardingSegment, onboardingContext.isFreePlan, track])

  // Onboarding handlers
  const handleStartAction = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/complete-tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourName: 'main-onboarding' }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Force refresh the onboarding context to get the latest completed tours from database
      const contextResponse = await fetch('/api/onboarding/context');
      if (contextResponse.ok) {
        const freshContext = await contextResponse.json();
        // Update the context with the fresh data
        updateOnboardingContext({
          completedTours: freshContext.completedTours || [],
          _loaded: true
        });
      }

      // Track onboarding completion
      if (session?.user?.id) {
        track('onboarding_completed', {
          user_id: session.user.id,
          onboarding_segment: onboardingContext.onboardingSegment,
          is_free_plan: onboardingContext.isFreePlan,
          final_step: 1,
          completion_time: Date.now()
        })
      }

      // Navigate based on plan type and segment
      // Send everyone straight to generation start with mobile handoff
      resetFlow()
      router.push('/app/generate/start');
    } catch (error) {
      console.error('Failed to mark onboarding as complete:', error);
      // Show user-facing error (you can style this better or use a toast library)
      alert('Failed to save onboarding completion. Please try again.');
      // Do NOT set hasCompletedMainOnboarding(true) on error
    }
  }, [session?.user?.id, onboardingContext.onboardingSegment, onboardingContext.isFreePlan, track, updateOnboardingContext, resetFlow, router])

  // Read onboarding completion status from database (via onboardingContext.completedTours)
  useEffect(() => {
    if (onboardingContext._loaded) {
      // Check if main-onboarding is in completedTours array from database
      const completedTours = onboardingContext.completedTours || []
      const completed = completedTours.includes('main-onboarding')

      // If we have the immediate flag set, override the completion status
      if (showOnboardingImmediately) {
        setHasCompletedMainOnboarding(false)
        // Clear the flag now that onboarding context is loaded
        setShowOnboardingImmediately(false)
      } else {
        setHasCompletedMainOnboarding(completed)
      }
    }
  }, [onboardingContext._loaded, onboardingContext.completedTours, showOnboardingImmediately])

  // Handle success message: cleanup URL and auto-hide
  useEffect(() => {
    if (!showSuccessMessage || urlCleanedRef.current) return
    
    // Remove the success parameters from URL (one-time cleanup)
    urlCleanedRef.current = true
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('success')
    newUrl.searchParams.delete('type')
    // Use relative URL to avoid port issues from reverse proxy
    const cleanUrl = newUrl.pathname + (newUrl.search || '')
    window.history.replaceState({}, '', cleanUrl)
    
    // Hide message after 5 seconds
    const timer = setTimeout(() => {
      setShowSuccessMessage(false)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [showSuccessMessage])

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // OPTIMIZATION: Fetch all dashboard data in a single API call
      // This consolidates stats, activity, and pending invites into one request
      // reducing database queries from 9-15 to 3-5 per dashboard load
      const dashboardData = await jsonFetcher<{
        success: boolean;
        stats: DashboardStats;
        userRole: UserPermissions & {
          needsTeamSetup?: boolean;
          needsPhotoStyleSetup?: boolean;
          nextTeamOnboardingStep?: 'team_setup' | 'style_setup' | 'invite_members' | null;
        };
        activities: Activity[];
        pendingInvites: PendingInvite[];
      }>('/api/dashboard')

      if (dashboardData.success && dashboardData.stats) {
        // Redirect team admins who need to set up their team (not on individual domains)
        if (!isIndividualDomain && dashboardData.userRole?.needsTeamSetup && dashboardData.userRole?.isTeamAdmin) {
          // Clear stale sessionStorage cache to ensure team page fetches fresh data
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('teamshots.initialData')
          }
          router.push('/app/team')
          return
        }

        setStats(dashboardData.stats)
        setUserPermissions(normalizeUserPermissions(dashboardData.userRole))
        setRecentActivity(dashboardData.activities || [])
        setPendingInvites(dashboardData.pendingInvites || [])

        // IMPORTANT: Do NOT redirect based on needsPhotoStyleSetup
        // Users should complete onboarding first, then navigate to photo styles when ready
        // The onboarding flow will guide them appropriately
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Keep default stats on error
    } finally {
      setLoading(false)
    }
  }, [router, isIndividualDomain])

  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData()
    }
  }, [session?.user?.id, fetchDashboardData])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return t('timeAgo.justNow')
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return t('timeAgo.minutesAgo', { count: minutes })
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return t('timeAgo.hoursAgo', { count: hours })
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return t('timeAgo.daysAgo', { count: days })
    }
  }

  const handleResendInvite = useCallback(async (inviteId: string) => {
    setResending(inviteId)
    try {
      await jsonFetcher('/api/team/invites/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId })
      })

      // Refresh pending invites
      const invitesData = await jsonFetcher<{ pendingInvites: PendingInvite[] }>('/api/dashboard/pending-invites')
      setPendingInvites(invitesData.pendingInvites)
    } catch (error) {
      console.error('Failed to resend invite:', error)
    } finally {
      setResending(null)
    }
  }, [])

  // SSR hydration indicator - prevents hydration mismatch for client-only content
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    setMounted(true)
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const handleSelfiesApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    // Redirect to generation start with the first approved selfie
    if (results.length > 0) {
      router.push(`/app/generate/start?key=${encodeURIComponent(results[0].key)}`)
    }
  }, [router])

  // On individual domains, suppress team roles for display purposes
  // The user may actually be a team admin, but Portreya treats everyone as individual
  const displayPermissions: UserPermissions = isIndividualDomain
    ? { ...userPermissions, isTeamAdmin: false, isTeamMember: false, isRegularUser: true, isSeatsBasedTeam: false }
    : userPermissions

  // On individual domains, always show individual onboarding regardless of actual segment
  const displaySegment = isIndividualDomain ? 'individual' : onboardingContext.onboardingSegment

  // Calculate total photos
  // On individual domains, always use individual credits
  const totalCredits = credits && !isIndividualDomain && (userPermissions.isTeamAdmin || userPermissions.isTeamMember)
    ? (credits.team || 0)
    : (credits?.individual || 0)

  const totalPhotos = calculatePhotosFromCredits(totalCredits)

  // Stats configuration based on product type
  // TeamShots (seats-based): Team members, Photos generated, Active photo style
  // Portreya (individual): Photo credits (separate), Photos generated, Active photo styles
  const statsConfig = displayPermissions.isSeatsBasedTeam
    ? [
        // TeamShots: Team members first
        {
          name: t('stats.teamMembers'),
          value: stats.teamMembers.toString(),
          icon: UsersIcon,
        },
        {
          name: t('stats.photosGenerated'),
          value: stats.photosGenerated.toString(),
          icon: PhotoIcon,
        },
        {
          name: t('stats.activeTemplates'),
          value: stats.activeTemplates.toString(),
          icon: DocumentTextIcon,
        },
      ]
    : [
        // Portreya: Photos generated, Active templates, Team members (if admin)
        {
          name: t('stats.photosGenerated'),
          value: stats.photosGenerated.toString(),
          icon: PhotoIcon,
        },
        {
          name: t('stats.activeTemplates'),
          value: stats.activeTemplates.toString(),
          icon: DocumentTextIcon,
        },
        ...(displayPermissions.isTeamAdmin ? [{
          name: t('stats.teamMembers'),
          value: stats.teamMembers.toString(),
          icon: UsersIcon,
        }] : []),
      ]

  return (
    <div className="space-y-8 md:space-y-10 lg:space-y-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-[var(--text-body)]">
      {/* Onboarding Flow - Show first if applicable to prevent flickering */}
      {showOnboardingSection && (
        <div className="rounded-xl shadow-depth-sm border border-[var(--brand-primary-hover)] p-8 md:p-10 lg:p-12 animate-fade-in bg-[var(--bg-white)]">
          {/* How It Works */}
          <div className="text-center space-y-6" id="how-it-works">
              <div className="max-w-3xl mx-auto">
                <h3 className="text-xl md:text-2xl font-semibold mb-6 text-[var(--text-dark)]">
                  {t('onboarding.howItWorks.title')}
                </h3>
                <div className="space-y-5 md:space-y-6 text-left">
                  {displaySegment === 'organizer' ? (
                    <>
                      {onboardingContext.isFreePlan ? (
                        <>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              1
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.free.step1.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.free.step1.description', { brandName })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              2
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.free.step2.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.free.step2.description')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              3
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.free.step3.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.free.step3.description')}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              1
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.step1.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.step1.description')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              2
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.step2.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.step2.description')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-5 md:gap-6">
                            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                              3
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold mb-2 text-base md:text-lg text-[var(--text-dark)]">{t('onboarding.howItWorks.organizer.step3.title')}</h4>
                              <p className="text-sm md:text-base leading-relaxed text-[var(--text-body)]">
                                {t('onboarding.howItWorks.organizer.step3.description')}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : displaySegment === 'invited' ? (
                    <>
                      <div className="flex items-start gap-5 md:gap-6">
                        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                          1
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">{t('onboarding.howItWorks.invited.step1.title')}</h4>
                          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                            {t('onboarding.howItWorks.invited.step1.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 md:gap-6">
                        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                          2
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">{t('onboarding.howItWorks.invited.step2.title')}</h4>
                          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                            {t('onboarding.howItWorks.invited.step2.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 md:gap-6">
                        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                          3
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">{t('onboarding.howItWorks.invited.step3.title')}</h4>
                          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                            {t('onboarding.howItWorks.invited.step3.description')}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-5 md:gap-6">
                        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                          1
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">{t('onboarding.howItWorks.individual.step1.title')}</h4>
                          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                            {t('onboarding.howItWorks.individual.step1.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 md:gap-6">
                        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold text-base md:text-lg">
                          2
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">{t('onboarding.howItWorks.individual.step3.title')}</h4>
                          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                            {onboardingContext.isFreePlan 
                              ? t('onboarding.howItWorks.individual.step3.descriptionFree')
                              : t('onboarding.howItWorks.individual.step3.descriptionPaid')}
                          </p>
                        </div>
                      </div>
                      {!onboardingContext.isFreePlan && (
                        <p className="mt-6 text-sm md:text-base text-gray-500 italic leading-relaxed">
                          {t('onboarding.howItWorks.individual.note')}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-8">
                  <button
                    onClick={handleStartAction}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
                  >
                    {t('onboarding.firstAction.shared.button')}
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className={`bg-brand-secondary-light border border-brand-secondary-lighter rounded-xl p-4 flex items-center transition-all duration-300 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <CheckCircleIcon className="h-5 w-5 text-brand-secondary mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-brand-secondary-text-light">{successMessage}</p>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="ml-4 text-brand-secondary/60 hover:text-brand-secondary flex-shrink-0 p-1 transition-colors"
            aria-label="Close success message"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Selfie Upload Flow */}
      {showUploadFlow && (
        <SelfieUploadFlow
          onSelfiesApproved={handleSelfiesApproved}
          onCancel={() => setShowUploadFlow(false)}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            alert(error)
          }}
        />
      )}

      {!showUploadFlow && !shouldShowOnboarding && mounted && (
        <>
          {/* Welcome Section */}
          <div
            id="welcome-section"
            className={`relative bg-gradient-to-br from-brand-primary via-brand-primary-hover via-60% to-brand-primary rounded-xl p-6 md:p-8 lg:p-10 text-white shadow-[0_10px_25px_-5px_rgb(0_0_0_/0.2),0_4px_6px_-2px_rgb(0_0_0_/0.1)] transition-all duration-300 animate-fade-in overflow-hidden`}
            style={{ animationDelay: '0ms' }}
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white/0 via-white/10 to-white/0 animate-pulse" />
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px',
              backgroundPosition: '0 0, 16px 16px'
            }} />
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-3 text-white leading-tight tracking-tight">
                {displayPermissions.isFirstVisit
                  ? t('welcome.titleFirstTime', {name: firstName})
                  : t('welcome.title', {name: firstName})
                }
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-white/90 leading-relaxed font-medium">
              {loading ? (
                <span className="animate-pulse">Loading your stats...</span>
              ) : displayPermissions.isTeamAdmin ? (
                stats.teamMembers === 0 ? (
                  isFreePlan ? (
                    t('welcome.subtitle.teamAdminNoMembersFree')
                  ) : (
                    t('welcome.subtitle.teamAdminNoMembersPaid')
                  )
                ) : stats.photosGenerated === 0 ? (
                  t('welcome.subtitle.teamAdminMembersNoPhotos', { teamMembers: stats.teamMembers })
                ) : (
                  t('welcome.subtitle.teamAdminMembersWithPhotos', {
                    count: stats.photosGenerated,
                    teamMembers: stats.teamMembers
                  })
                )
              ) : displayPermissions.isRegularUser || !displayPermissions.isTeamAdmin ? (  // Treat regular and default as individual
                stats.photosGenerated === 0 ? (
                  isFreePlan ? (
                    t('welcome.subtitle.individualNoPhotosFree')
                  ) : (
                    t('welcome.subtitle.individualNoPhotosPaid')
                  )
                ) : (
                  t('welcome.subtitle.individualWithPhotos', {
                    count: stats.photosGenerated
                  })
                )
              ) : displayPermissions.isTeamMember ? (
                stats.photosGenerated === 0 ? (
                  t('welcome.subtitle.teamNoPhotos')
                ) : (
                  t('welcome.subtitle.teamWithPhotos', {
                    count: stats.photosGenerated
                  })
                )
              ) : (
                t('welcome.subtitle.individual', {
                  count: stats.photosGenerated
                })
              )}
            </p>
            </div>
          </div>

          {/* Stats Grid - Credit Status Card First (Portreya only), Then Other Stats */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${displayPermissions.isSeatsBasedTeam ? 'lg:grid-cols-3' : (displayPermissions.isTeamAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3')} gap-6 md:gap-8 animate-fade-in`} style={{ animationDelay: '100ms' }}>
            {/* Credit Status Card - Only show for Portreya (non-seats-based) */}
            {!displayPermissions.isSeatsBasedTeam && (loading || creditsLoading ? (
              <div className="rounded-xl p-6 shadow-depth-sm border border-[var(--brand-primary-hover)] animate-pulse bg-[var(--bg-white)]">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="ml-4 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            ) : (
              <div
                className={`rounded-xl p-7 md:p-8 shadow-[0_2px_4px_0_rgb(0_0_0_/0.08),0_1px_2px_-1px_rgb(0_0_0_/0.04)] border border-[var(--brand-primary-hover)] hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.1),0_4px_6px_-2px_rgb(0_0_0_/0.05)] transition-all duration-200 bg-[var(--bg-white)] ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                style={{ animationDelay: '100ms' }}
              >
                <div className="flex items-start mb-5">
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-primary-light to-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <SparklesIcon className="h-7 w-7 text-brand-primary" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-3 text-[var(--text-muted)]">{t('stats.photos')}</p>
                    <p className="text-4xl md:text-5xl font-extrabold mb-2 leading-none tracking-tight text-[var(--text-dark)]">{totalPhotos}</p>
                    <p className="text-sm font-medium mb-5 text-[var(--text-muted)]">{t('stats.photosUnit')}</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/app/top-up')}
                  className="text-sm font-medium text-brand-cta hover:text-brand-cta-hover transition-colors flex items-center group"
                >
                  {t('stats.buyMore')}
                  <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              </div>
            ))}

            {/* Other Stats Cards */}
            {loading ? (
              statsConfig.map((_, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-xl p-6 shadow-depth-sm border border-gray-200 animate-pulse"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="ml-4 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              statsConfig.map((stat, index) => {
                // Special handling for active photo styles on free plan
                const isActiveTemplatesStat = stat.name === t('stats.activeTemplates')
                if (isActiveTemplatesStat && isFreePlan) {
                  return (
                    <div 
                      key={stat.name} 
                      className={`bg-gradient-to-br from-white to-gray-50/50 rounded-xl p-7 md:p-8 shadow-[0_2px_4px_0_rgb(0_0_0_/0.08),0_1px_2px_-1px_rgb(0_0_0_/0.04)] border border-gray-200/60 hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.1),0_4px_6px_-2px_rgb(0_0_0_/0.05)] transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                      style={{ animationDelay: `${(index + 2) * 100}ms` }}
                    >
                      <div className="flex items-start">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-primary-light to-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                          <stat.icon className="h-7 w-7 text-brand-primary" />
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-muted mb-3">{stat.name}</p>
                          <div className="flex items-baseline gap-2 mb-2">
                            <p className="text-xl md:text-2xl font-bold text-text-dark leading-none tracking-tight">Free Package</p>
                          </div>
                          <button
                            onClick={() => router.push('/app/upgrade')}
                            className="text-sm font-medium text-brand-cta hover:text-brand-cta-hover transition-colors flex items-center group mt-1"
                          >
                            {t('stats.unlockPhotoStyles')}
                            <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }
                
                // Default stat card rendering
                return (
                  <div 
                    key={stat.name} 
                    className={`relative bg-gradient-to-br from-white via-gray-50/30 to-white rounded-xl p-7 md:p-8 shadow-[0_2px_4px_0_rgb(0_0_0_/0.08),0_1px_2px_-1px_rgb(0_0_0_/0.04)] border border-gray-200/60 hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.1),0_4px_6px_-2px_rgb(0_0_0_/0.05)] hover:scale-[1.02] transition-all duration-300 ${mounted ? 'animate-fade-in' : 'opacity-0'} overflow-hidden`}
                    style={{ animationDelay: `${(index + 2) * 100 + 50}ms` }}
                  >
                    {/* Subtle texture */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{
                      backgroundImage: `linear-gradient(45deg, transparent 30%, rgba(0,0,0,0.05) 50%, transparent 70%)`,
                      backgroundSize: '20px 20px'
                    }} />
                    <div className="relative z-10">
                    <div className="flex items-start">
                      <div className="relative w-12 h-12 bg-gradient-to-br from-brand-primary-light to-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <stat.icon className="h-7 w-7 text-brand-primary relative z-10" />
                      </div>
                      <div className="ml-4 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-muted mb-3">{stat.name}</p>
                        <p className="text-3xl md:text-4xl font-extrabold text-text-dark leading-none tracking-tight">{stat.value}</p>
                      </div>
                    </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Main Content Area - Activity & Invites */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Recent Activity - Only for Team Admins */}
            {displayPermissions.isTeamAdmin && (
              <div className={`bg-white rounded-xl shadow-[0_1px_3px_0_rgb(0_0_0_/0.1),0_1px_2px_-1px_rgb(0_0_0_/0.1)] border border-gray-200/80 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0_/0.1),0_2px_4px_-2px_rgb(0_0_0_/0.1)] transition-shadow duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
                <div className="p-6 md:p-7 border-b border-gray-200">
                  <h3 className="text-xl md:text-2xl font-bold text-text-dark tracking-tight">{t('recentActivity.title')}</h3>
                </div>
                <div className="p-6 md:p-7">
                  {loading ? (
                    <div className="space-y-5">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-start gap-4 animate-pulse">
                          <div className="w-6 h-6 bg-gray-200 rounded-full mt-0.5"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-4 py-3 px-2 rounded-lg hover:bg-gray-50/50 transition-colors duration-150">
                          <div className="flex-shrink-0 mt-0.5">
                            {activity.status === 'completed' ? (
                              <div className="w-8 h-8 rounded-full bg-brand-secondary/10 flex items-center justify-center">
                                <CheckCircleIcon className="h-5 w-5 text-brand-secondary" />
                              </div>
                            ) : activity.status === 'processing' ? (
                              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                <ClockIcon className="h-5 w-5 text-brand-primary" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand-cta/10 flex items-center justify-center">
                                <ClockIcon className="h-5 w-5 text-brand-cta" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-base text-text-dark leading-relaxed">
                              <span className="font-bold text-text-dark">{activity.user}</span> <span className="text-text-muted">{activity.action}</span>
                              {activity.generationType && (
                                <span className={`ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  activity.generationType === 'personal' 
                                    ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' 
                                    : 'bg-brand-secondary/10 text-brand-secondary-text border border-brand-secondary/20'
                                }`}>
                                  {activity.generationType === 'personal' ? t('recentActivity.generationType.personal') : t('recentActivity.generationType.team')}
                                </span>
                              )}
                            </p>
                            <p className="text-xs md:text-sm text-text-muted mt-2 font-medium">{formatTimeAgo(activity.time)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClockIcon className="h-8 w-8 text-brand-primary" />
                      </div>
                      <p className="text-base font-semibold text-text-dark mb-2">{t('recentActivity.noActivity')}</p>
                      <p className="text-sm text-text-muted">Activity will appear here once your team starts generating photos</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Invites - Only for Team Admins */}
            {displayPermissions.isTeamAdmin && (
              <div className={`bg-white rounded-xl shadow-[0_1px_3px_0_rgb(0_0_0_/0.1),0_1px_2px_-1px_rgb(0_0_0_/0.1)] border border-gray-200/80 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0_/0.1),0_2px_4px_-2px_rgb(0_0_0_/0.1)] transition-shadow duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '400ms', animation: 'fadeInUp 0.6s ease-out' }}>
                <div className="p-6 md:p-7 border-b border-gray-200">
                  <h3 className="text-xl md:text-2xl font-bold text-text-dark tracking-tight">{t('pendingInvites.title')}</h3>
                </div>
                <div className="p-6 md:p-7">
                  {loading ? (
                    <div className="space-y-5">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between animate-pulse">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-48 mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-24"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                            <div className="h-4 bg-gray-200 rounded w-12"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : pendingInvites.length > 0 ? (
                    <div className="space-y-4">
                      {pendingInvites.map((invite) => (
                        <div key={invite.id} className="pb-5 border-b border-gray-200/60 last:border-0 last:pb-0 hover:bg-gray-50/30 rounded-lg px-3 py-2 -mx-3 transition-colors duration-150">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm md:text-base font-bold text-text-dark">{invite.name}</p>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                  {t('pendingInvites.status.pending')}
                                </span>
                              </div>
                              <p className="text-xs md:text-sm text-text-muted mt-1 font-medium">{invite.email}</p>
                              <p className="text-xs md:text-sm text-text-muted mt-1.5 font-medium">{t('pendingInvites.sent', { when: invite.sent })}</p>
                            </div>
                            <button 
                              onClick={() => handleResendInvite(invite.id)}
                              disabled={resending === invite.id}
                              className="text-sm font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors disabled:opacity-50 hover:underline flex-shrink-0"
                            >
                              {resending === invite.id ? t('pendingInvites.resending') : t('pendingInvites.resend')}
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-5 border-t border-gray-200/60 mt-5">
                        <button 
                          onClick={() => router.push('/app/team')}
                          className="w-full flex items-center justify-center px-5 py-3.5 border-2 border-brand-primary/30 rounded-xl text-sm font-bold text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 hover:border-brand-primary transition-all duration-200"
                        >
                          <PlusIcon className="h-5 w-5 mr-2" />
                          {t('pendingInvites.invite')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserGroupIcon className="h-8 w-8 text-brand-primary" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 mb-2">{t('pendingInvites.noInvites')}</p>
                      <p className="text-sm text-gray-600 mb-6">Invite team members to get started</p>
                      <button 
                        onClick={() => router.push('/app/team')}
                        className="inline-flex items-center px-5 py-3 border-2 border-brand-primary/30 rounded-xl text-sm font-bold text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 hover:border-brand-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        {t('pendingInvites.invite')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`bg-white rounded-xl shadow-[0_1px_3px_0_rgb(0_0_0_/0.1),0_1px_2px_-1px_rgb(0_0_0_/0.1)] border border-gray-200/80 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0_/0.1),0_2px_4px_-2px_rgb(0_0_0_/0.1)] transition-shadow duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
            <div className="p-6 md:p-7 border-b border-gray-200">
              <h3 className="text-xl md:text-2xl font-bold text-text-dark tracking-tight">{t('quickActions.title')}</h3>
            </div>
            <div className="p-6 md:p-7">
              <div className={`grid grid-cols-1 ${displayPermissions.isTeamAdmin ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-5 md:gap-6`}>
                {/* Primary Action - Generate Photos */}
                <button 
                  onClick={() => {
                    // Clear any stale flow flags to ensure a clean start
                    resetFlow()
                    router.push('/app/generate/start')
                  }}
                  className="flex flex-col items-center justify-center px-8 py-10 border-2 border-brand-cta/30 rounded-xl hover:border-brand-cta hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.15)] transition-all duration-200 bg-gradient-to-br from-brand-cta/5 to-transparent group min-h-[160px]"
                >
                  <div className="w-14 h-14 bg-brand-cta rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                    <PhotoIcon className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-lg md:text-xl font-extrabold text-text-dark group-hover:text-brand-cta transition-colors">{t('quickActions.generate')}</span>
                </button>
                
                {/* Secondary Actions */}
                <button 
                  onClick={() => router.push('/app/styles')}
                  className="flex flex-col items-center justify-center px-8 py-10 border-2 border-brand-primary/30 rounded-xl hover:border-brand-primary hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.15)] transition-all duration-200 bg-gradient-to-br from-brand-primary/5 to-transparent group min-h-[160px]"
                >
                  <div className="w-14 h-14 bg-brand-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                    <DocumentTextIcon className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-lg md:text-xl font-extrabold text-text-dark group-hover:text-brand-primary transition-colors">{t('quickActions.createTemplate')}</span>
                </button>
                
                {displayPermissions.isTeamAdmin && (
                  <button 
                    onClick={() => router.push('/app/team')}
                    className="flex flex-col items-center justify-center px-8 py-10 border-2 border-brand-primary/30 rounded-xl hover:border-brand-primary hover:shadow-[0_8px_16px_-4px_rgb(0_0_0_/0.15)] transition-all duration-200 bg-gradient-to-br from-brand-primary/5 to-transparent group min-h-[160px]"
                  >
                    <div className="w-14 h-14 bg-brand-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                      <UsersIcon className="h-7 w-7 text-white" />
                    </div>
                    <span className="text-lg md:text-xl font-extrabold text-text-dark group-hover:text-brand-primary transition-colors">{t('quickActions.manageTeam')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Feedback Button */}
      <FeedbackButton context="dashboard" />
    </div>
  )
}
