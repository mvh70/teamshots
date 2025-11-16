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
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/routing'
import { useEffect, useState } from 'react'
import { jsonFetcher } from '@/lib/fetcher'
import { useCredits } from '@/contexts/CreditsContext'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { WelcomeGallery } from '@/components/onboarding/WelcomeGallery'
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress'
import { useOnboardingState } from '@/lib/onborda/hooks'

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
})

export default function DashboardPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations('app.dashboard')
  const { credits, loading: creditsLoading } = useCredits()
  const { isFreePlan } = usePlanInfo()
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
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showUploadFlow, setShowUploadFlow] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Onboarding state
  const { context: onboardingContext } = useOnboardingState()
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [hasCompletedMainOnboarding, setHasCompletedMainOnboarding] = useState(false)
  const shouldShowOnboarding = !hasCompletedMainOnboarding && onboardingContext._loaded

  // Onboarding handlers
  const handleStartAction = () => {
    // Mark onboarding as complete
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding-main-onboarding-seen', 'true')
      setHasCompletedMainOnboarding(true)
    }
    
    // Navigate based on plan type and segment
    const segment = onboardingContext.onboardingSegment || 'individual'
    const isFree = onboardingContext.isFreePlan ?? true
    
    if (segment === 'organizer') {
      if (isFree) {
        // Free plan: redirect to team page to invite yourself
        // Set flag to automatically open invite modal when they arrive at team page
        sessionStorage.setItem('open-invite-modal', 'true')
        router.push('/app/team')
      } else {
        // Paid plan: redirect to photo styles page to set brand style
        router.push('/app/styles/team')
      }
    } else {
      // Individual users go to generate
      router.push('/app/generate/start')
    }
  }

  // Read onboarding completion status from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('onboarding-main-onboarding-seen') === 'true'
      setHasCompletedMainOnboarding(completed)
    }
  }, [])

  // Check for success parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      setShowSuccessMessage(true)
      
      // Get specific success message based on type
      const messageType = urlParams.get('type')
      let message = t('successMessages.default')
      
      switch (messageType) {
        case 'try_once_success':
          message = t('successMessages.tryOnce', { credits: PRICING_CONFIG.tryOnce.credits })
          break
        case 'individual_success':
          message = t('successMessages.individual', { credits: PRICING_CONFIG.individual.includedCredits })
          break
        case 'pro_success':
          message = t('successMessages.pro', { credits: PRICING_CONFIG.pro.includedCredits })
          break
        case 'top_up_success':
          message = t('successMessages.topUp')
          break
        default:
          message = t('successMessages.default')
      }
      
      setSuccessMessage(message)
      
      // Remove the success parameters from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('success')
      newUrl.searchParams.delete('type')
      window.history.replaceState({}, '', newUrl.toString())
      
      // Hide message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 5000)
    }
  }, [t])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // OPTIMIZATION: Fetch all dashboard data in a single API call
        // This consolidates stats, activity, and pending invites into one request
        // reducing database queries from 9-15 to 3-5 per dashboard load
        const dashboardData = await jsonFetcher<{ 
          success: boolean;
          stats: DashboardStats; 
          userRole: UserPermissions;
          activities: Activity[];
          pendingInvites: PendingInvite[];
        }>('/api/dashboard')
        
        if (dashboardData.success && dashboardData.stats) {
          setStats(dashboardData.stats)
          setUserPermissions(normalizeUserPermissions(dashboardData.userRole))
          setRecentActivity(dashboardData.activities || [])
          setPendingInvites(dashboardData.pendingInvites || [])
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Keep default stats on error
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchDashboardData()
    }
  }, [session?.user?.id])

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

  const handleResendInvite = async (inviteId: string) => {
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
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelfieApproved = async (selfieKey: string) => {
    // Redirect to generation start with approved selfie
    router.push(`/app/generate/start?key=${encodeURIComponent(selfieKey)}`)
  }

  // Calculate total credits and generations available
  // For team admins/members: only show team credits (individual credits are unmigrated pro credits already included in team balance)
  // For individual users: show individual credits only
  const totalCredits = credits && (userPermissions.isTeamAdmin || userPermissions.isTeamMember)
    ? (credits.team || 0)
    : (credits?.individual || 0)
  
  const generationsAvailable = Math.floor(totalCredits / PRICING_CONFIG.credits.perGeneration)

  // Stats configuration (excluding credits which gets special treatment)
  const statsConfig = [
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
    ...(userPermissions.isTeamAdmin ? [{
      name: t('stats.teamMembers'),
      value: stats.teamMembers.toString(),
      icon: UsersIcon,
    }] : []),
  ]

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
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

      {/* Onboarding Flow */}
      {shouldShowOnboarding && (
        <div className="bg-white rounded-xl shadow-depth-sm border border-gray-200 p-8">
          <OnboardingProgress
            currentStep={onboardingStep}
            totalSteps={3}
            className="mb-8"
          />

          {/* Step 1: Welcome with Gallery */}
          {onboardingStep === 1 && (
            <div className="text-center space-y-8">
              <WelcomeGallery />
            </div>
          )}

          {/* Step 2: How It Works */}
          {onboardingStep === 2 && (
            <div className="text-center space-y-6" id="how-it-works">
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {t('onboarding.howItWorks.title')}
                </h3>
                <div className="space-y-4 text-left">
                  {onboardingContext.onboardingSegment === 'organizer' ? (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          1
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.organizer.step1.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.organizer.step1.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          2
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.organizer.step2.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.organizer.step2.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          3
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.organizer.step3.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.organizer.step3.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          4
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.organizer.step4.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.organizer.step4.description')}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : onboardingContext.onboardingSegment === 'invited' ? (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          1
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.invited.step1.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.invited.step1.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          2
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.invited.step2.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.invited.step2.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          3
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.invited.step3.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.invited.step3.description')}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          1
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.individual.step1.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.individual.step1.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          2
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.individual.step2.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {t('onboarding.howItWorks.individual.step2.description')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white font-semibold">
                          3
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{t('onboarding.howItWorks.individual.step3.title')}</h4>
                          <p className="text-sm text-gray-600">
                            {onboardingContext.isFreePlan 
                              ? t('onboarding.howItWorks.individual.step3.descriptionFree')
                              : t('onboarding.howItWorks.individual.step3.descriptionPaid')}
                          </p>
                        </div>
                      </div>
                      {!onboardingContext.isFreePlan && (
                        <p className="mt-6 text-sm text-gray-500 italic">
                          {t('onboarding.howItWorks.individual.note')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: First Action */}
          {onboardingStep === 3 && (
            <div className="text-center space-y-6" id="first-action">
              <div className="max-w-md mx-auto">
                {onboardingContext.onboardingSegment === 'organizer' ? (
                  <>
                    {onboardingContext.isFreePlan ? (
                      <>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {t('onboarding.firstAction.organizer.free.title')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                          {t('onboarding.firstAction.organizer.free.description')}
                        </p>
                        <button
                          onClick={handleStartAction}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
                        >
                          {t('onboarding.firstAction.organizer.free.button')}
                        </button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {t('onboarding.firstAction.organizer.paid.title')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                          {t('onboarding.firstAction.organizer.paid.description')}
                        </p>
                        <button
                          onClick={handleStartAction}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
                        >
                          {t('onboarding.firstAction.organizer.paid.button')}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {onboardingContext.isFreePlan ? (
                      <>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {t('onboarding.firstAction.individual.free.title')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                          {t('onboarding.firstAction.individual.free.description')}
                        </p>
                        <button
                          onClick={handleStartAction}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
                        >
                          {t('onboarding.firstAction.individual.free.button')}
                        </button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {t('onboarding.firstAction.individual.paid.title')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                          {t('onboarding.firstAction.individual.paid.description')}
                        </p>
                        <button
                          onClick={handleStartAction}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
                        >
                          {t('onboarding.firstAction.individual.paid.button')}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Navigation buttons for onboarding */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setOnboardingStep(Math.max(1, onboardingStep - 1))}
              disabled={onboardingStep === 1}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('onboarding.navigation.back')}
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('onboarding-main-onboarding-seen', 'true')
                    setHasCompletedMainOnboarding(true)
                    window.location.reload() // Refresh to hide onboarding
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                {t('onboarding.navigation.skip')}
              </button>

              {onboardingStep < 3 && (
                <button
                  onClick={() => setOnboardingStep(onboardingStep + 1)}
                  className="px-6 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary-hover min-h-[40px]"
                >
                  {t('onboarding.navigation.next')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selfie Upload Flow */}
      {showUploadFlow && (
        <SelfieUploadFlow
          onSelfieApproved={handleSelfieApproved}
          onCancel={() => setShowUploadFlow(false)}
          onError={(error) => {
            console.error('Selfie upload error:', error)
            alert(error)
          }}
        />
      )}

      {!showUploadFlow && (
        <>
          {/* Welcome Section */}
          <div 
            id="welcome-section" 
            className={`bg-gradient-to-r from-brand-primary to-brand-primary-hover rounded-xl p-6 md:p-8 text-white shadow-depth-lg transition-all duration-300 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
            style={{ animationDelay: '0ms' }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white leading-tight">
              {userPermissions.isFirstVisit
                ? t('welcome.titleFirstTime', {name: firstName})
                : t('welcome.title', {name: firstName})
              }
            </h2>
            <p className="text-base md:text-lg text-white/95 leading-relaxed">
              {loading ? (
                <span className="animate-pulse">Loading your stats...</span>
              ) : userPermissions.isTeamAdmin ? (
                t('welcome.subtitle.teamAdmin', {
                  count: stats.photosGenerated,
                  teamMembers: stats.teamMembers
                })
              ) : userPermissions.isRegularUser ? (
                t('welcome.subtitle.individual', {
                  count: stats.photosGenerated
                })
              ) : userPermissions.isTeamMember ? (
                t('welcome.subtitle.team', {
                  count: stats.photosGenerated
                })
              ) : (
                t('welcome.subtitle.individual', {
                  count: stats.photosGenerated
                })
              )}
            </p>
          </div>

          {/* Stats Grid - Credit Status Card First, Then Other Stats */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${userPermissions.isTeamAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
            {/* Credit Status Card - Prominent First Card */}
            {loading || creditsLoading ? (
              <div className="bg-white rounded-xl p-6 shadow-depth-sm border border-gray-200 animate-pulse">
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
                className={`bg-white rounded-xl p-6 shadow-depth-sm border border-gray-200 hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                style={{ animationDelay: '100ms' }}
              >
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-brand-primary-light rounded-lg flex items-center justify-center">
                    <SparklesIcon className="h-6 w-6 text-brand-primary" />
                  </div>
                  <p className="ml-4 text-sm font-medium text-text-muted">{t('stats.credits')}</p>
                </div>
                <p className="text-3xl font-bold text-text-dark mb-1 leading-tight">{totalCredits}</p>
                <p className="text-sm text-text-muted mb-4">{t('stats.creditsUnit')}</p>
                <p className="text-xs text-text-muted mb-4">
                  {generationsAvailable} {t('stats.generationsAvailable', { count: generationsAvailable })}
                </p>
                <button
                  onClick={() => router.push('/app/top-up')}
                  className="text-sm font-medium text-brand-cta hover:text-brand-cta-hover transition-colors flex items-center group"
                >
                  {t('stats.buyMore')}
                  <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              </div>
            )}

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
                      className={`bg-white rounded-xl p-6 shadow-depth-sm border border-gray-200 hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                      style={{ animationDelay: `${(index + 2) * 100}ms` }}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-brand-primary-light rounded-lg flex items-center justify-center flex-shrink-0">
                          <stat.icon className="h-6 w-6 text-brand-primary" />
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-muted mb-1">{stat.name}</p>
                          <div className="flex items-baseline gap-2 mb-2">
                            <p className="text-2xl font-bold text-text-dark leading-tight">Free Package</p>
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
                    className={`bg-white rounded-xl p-6 shadow-depth-sm border border-gray-200 hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                    style={{ animationDelay: `${(index + 2) * 100}ms` }}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-brand-primary-light rounded-lg flex items-center justify-center flex-shrink-0">
                        <stat.icon className="h-6 w-6 text-brand-primary" />
                      </div>
                      <div className="ml-4 flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-muted mb-1">{stat.name}</p>
                        <p className="text-2xl font-bold text-text-dark leading-tight">{stat.value}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Main Content Area - Activity & Invites */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity - Only for Team Admins */}
            {userPermissions.isTeamAdmin && (
              <div className={`bg-white rounded-xl shadow-depth-sm border border-gray-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-text-dark">{t('recentActivity.title')}</h3>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-start gap-3 animate-pulse">
                          <div className="w-5 h-5 bg-gray-200 rounded-full mt-0.5"></div>
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
                        <div key={activity.id} className="flex items-start gap-3 py-2">
                          <div className="flex-shrink-0 mt-0.5">
                            {activity.status === 'completed' ? (
                              <CheckCircleIcon className="h-5 w-5 text-brand-secondary" />
                            ) : activity.status === 'processing' ? (
                              <ClockIcon className="h-5 w-5 text-brand-primary" />
                            ) : (
                              <ClockIcon className="h-5 w-5 text-brand-cta" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-dark">
                              <span className="font-semibold">{activity.user}</span> {activity.action}
                              {activity.generationType && (
                                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  activity.generationType === 'personal' 
                                    ? 'bg-brand-primary-light text-brand-primary' 
                                    : 'bg-brand-secondary-light text-brand-secondary-text'
                                }`}>
                                  {activity.generationType === 'personal' ? t('recentActivity.generationType.personal') : t('recentActivity.generationType.team')}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-text-muted mt-1">{formatTimeAgo(activity.time)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ClockIcon className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-text-muted">{t('recentActivity.noActivity')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Invites - Only for Team Admins */}
            {userPermissions.isTeamAdmin && (
              <div className={`bg-white rounded-xl shadow-depth-sm border border-gray-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-text-dark">{t('pendingInvites.title')}</h3>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="space-y-4">
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
                        <div key={invite.id} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-text-dark">{invite.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{invite.email}</p>
                              <p className="text-xs text-text-muted mt-1">{t('pendingInvites.sent', { when: invite.sent })}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary">
                                {t('pendingInvites.status.pending')}
                              </span>
                              <button 
                                onClick={() => handleResendInvite(invite.id)}
                                disabled={resending === invite.id}
                                className="text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors disabled:opacity-50"
                              >
                                {resending === invite.id ? t('pendingInvites.resending') : t('pendingInvites.resend')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-gray-200 mt-4">
                        <button 
                          onClick={() => router.push('/app/team')}
                          className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold text-text-dark bg-white hover:bg-gray-50 hover:border-brand-primary transition-all duration-200"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          {t('pendingInvites.invite')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <UserGroupIcon className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-text-muted mb-4">{t('pendingInvites.noInvites')}</p>
                      <button 
                        onClick={() => router.push('/app/team')}
                        className="inline-flex items-center px-4 py-2 border-2 border-gray-300 rounded-xl text-sm font-semibold text-text-dark bg-white hover:bg-gray-50 hover:border-brand-primary transition-all duration-200"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        {t('pendingInvites.invite')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`bg-white rounded-xl shadow-depth-sm border border-gray-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-text-dark">{t('quickActions.title')}</h3>
            </div>
            <div className="p-6">
              <div className={`grid grid-cols-1 ${userPermissions.isTeamAdmin ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                {/* Primary Action - Generate Photos */}
                <button 
                  onClick={() => router.push('/app/generate/start')}
                  className="flex flex-col items-center justify-center px-6 py-8 border-2 border-gray-300 rounded-xl hover:border-brand-cta hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 bg-white group min-h-[140px]"
                >
                  <div className="w-12 h-12 bg-brand-cta rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                    <PhotoIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-base font-semibold text-text-dark">{t('quickActions.generate')}</span>
                </button>
                
                {/* Secondary Actions */}
                <button 
                  onClick={() => router.push('/app/styles')}
                  className="flex flex-col items-center justify-center px-6 py-8 border-2 border-gray-300 rounded-xl hover:border-brand-primary hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 bg-white group min-h-[120px]"
                >
                  <div className="w-12 h-12 bg-brand-primary-light rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-200">
                    <DocumentTextIcon className="h-6 w-6 text-brand-primary group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-base font-semibold text-text-dark">{t('quickActions.createTemplate')}</span>
                </button>
                
                {userPermissions.isTeamAdmin && (
                  <button 
                    onClick={() => router.push('/app/team')}
                    className="flex flex-col items-center justify-center px-6 py-8 border-2 border-gray-300 rounded-xl hover:border-brand-primary hover:shadow-depth-md hover:scale-[1.02] transition-all duration-200 bg-white group min-h-[120px]"
                  >
                    <div className="w-12 h-12 bg-brand-primary-light rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-200">
                      <UsersIcon className="h-6 w-6 text-brand-primary group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-base font-semibold text-text-dark">{t('quickActions.manageTeam')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
