'use client'

import { useSession } from 'next-auth/react'
import {
  UsersIcon,
  PhotoIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import {useTranslations} from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/routing'
import { useEffect, useState } from 'react'
import { jsonFetcher } from '@/lib/fetcher'

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
          stats: DashboardStats; 
          userPermissions: UserPermissions;
          activities: Activity[];
          pendingInvites: PendingInvite[];
        }>('/api/dashboard')
        
        setStats(dashboardData.stats)
        setUserPermissions(normalizeUserPermissions(dashboardData.userPermissions))
        setRecentActivity(dashboardData.activities || [])
        setPendingInvites(dashboardData.pendingInvites || [])

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
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

  const handleSelfieApproved = async (selfieKey: string) => {
    // Redirect to generation start with approved selfie
    router.push(`/app/generate/start?key=${encodeURIComponent(selfieKey)}`)
  }

  const statsConfig = [
    ...(userPermissions.isTeamAdmin ? [{
      name: t('stats.teamMembers'),
      value: stats.teamMembers.toString(),
      change: '+0', // TODO: Calculate change from previous period
      changeType: 'increase' as const,
      icon: UsersIcon,
    }] : []),
    {
      name: t('stats.photosGenerated'),
      value: stats.photosGenerated.toString(),
      change: '+0', // TODO: Calculate change from previous period
      changeType: 'increase' as const,
      icon: PhotoIcon,
    },
    {
      name: t('stats.activeTemplates'),
      value: stats.activeTemplates.toString(),
      change: '+0', // TODO: Calculate change from previous period
      changeType: 'increase' as const,
      icon: DocumentTextIcon,
    },
    {
      name: t('stats.creditsUsed'),
      value: stats.creditsUsed.toString(),
      change: '+0', // TODO: Calculate change from previous period
      changeType: 'increase' as const,
      icon: ChartBarIcon,
    },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-lg p-4 md:p-6 flex items-center">
          <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-brand-secondary mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm md:text-base font-medium text-brand-secondary">Success!</h3>
            <p className="text-sm md:text-base text-brand-secondary/90 mt-1">{successMessage}</p>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="ml-4 text-brand-secondary/60 hover:text-brand-secondary flex-shrink-0 p-1"
            aria-label="Close success message"
          >
            <XMarkIcon className="h-5 w-5 md:h-6 md:w-6" />
          </button>
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
      <div id="welcome-section" className="bg-gradient-to-r from-brand-primary to-brand-primary-hover rounded-lg p-4 md:p-6 text-white">
        <h2 className="text-xl md:text-2xl font-bold mb-2 text-white">
          {userPermissions.isFirstVisit
            ? t('welcome.titleFirstTime', {name: firstName})
            : t('welcome.title', {name: firstName})
          }
        </h2>
        <p className="text-sm md:text-base text-brand-primary-light">
          {loading ? (
            <span className="animate-pulse">Loading your stats...</span>
          ) : userPermissions.isTeamAdmin ? (
            t('welcome.subtitle.teamAdmin', {
              count: stats.photosGenerated,
              teamMembers: stats.teamMembers
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

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${userPermissions.isTeamAdmin ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4 md:gap-6`}>
        {loading ? (
          // Loading skeleton
          Array.from({ length: userPermissions.isTeamAdmin ? 4 : 3 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="ml-4 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          statsConfig.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg p-4 md:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 md:w-8 md:h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
                    <stat.icon className="h-6 w-6 md:h-5 md:w-5 text-brand-primary" />
                  </div>
                </div>
                <div className="ml-3 md:ml-4 flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-gray-600">{stat.name}</p>
                  <div className="flex items-baseline flex-wrap gap-1">
                    <p className="text-xl md:text-2xl font-semibold text-gray-900">{stat.value}</p>
                    <p className={`text-xs md:text-sm font-medium ${
                      stat.changeType === 'increase' ? 'text-brand-secondary' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Activity - Only for Team Admins */}
        {userPermissions.isTeamAdmin && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-medium text-gray-900">{t('recentActivity.title')}</h3>
            </div>
            <div className="p-4 md:p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-start space-x-3 animate-pulse">
                      <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
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
                    <div key={activity.id} className="flex items-start space-x-3 py-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {activity.status === 'completed' ? (
                          <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-brand-secondary" />
                        ) : activity.status === 'processing' ? (
                          <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-brand-primary" />
                        ) : (
                          <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-brand-cta" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base text-gray-900">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                          {/* Generation type indicator */}
                          {activity.generationType && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              activity.generationType === 'personal' 
                                ? 'bg-brand-primary-light text-brand-primary' 
                                : 'bg-brand-secondary/10 text-brand-secondary'
                            }`}>
                              {activity.generationType === 'personal' ? t('recentActivity.generationType.personal') : t('recentActivity.generationType.team')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs md:text-sm text-gray-500 mt-1">{formatTimeAgo(activity.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">{t('recentActivity.noActivity')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Invites - Only for Team Admins */}
        {userPermissions.isTeamAdmin && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-medium text-gray-900">{t('pendingInvites.title')}</h3>
            </div>
            <div className="p-4 md:p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between animate-pulse">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-48 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingInvites.length > 0 ? (
                <div className="space-y-4">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invite.name}</p>
                        <p className="text-xs text-gray-500">{invite.email}</p>
                        <p className="text-xs text-gray-400">{t('pendingInvites.sent', { when: invite.sent })}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary">
                          {t('pendingInvites.status.pending')}
                        </span>
                        <button 
                          onClick={() => handleResendInvite(invite.id)}
                          disabled={resending === invite.id}
                          className="text-brand-primary hover:text-brand-primary-hover text-sm font-medium disabled:opacity-50"
                        >
                          {resending === invite.id ? t('pendingInvites.resending') : t('pendingInvites.resend')}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => router.push('/app/team')}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      {t('pendingInvites.invite')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm mb-4">{t('pendingInvites.noInvites')}</p>
                  <button 
                    onClick={() => router.push('/app/team')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('pendingInvites.invite')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Template Management - Only for Team Admins */}

      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 md:p-6 border-b border-gray-200">
          <h3 className="text-base md:text-lg font-medium text-gray-900">{t('quickActions.title')}</h3>
        </div>
        <div className="p-4 md:p-6">
          <div className={`grid grid-cols-1 ${userPermissions.isTeamAdmin ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2'} gap-3 md:gap-4`}>
            <button 
              onClick={() => setShowUploadFlow(true)}
              className="flex flex-col items-center justify-center px-4 py-4 md:px-6 md:py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[88px] md:min-h-0"
            >
              <PhotoIcon className="h-7 w-7 md:h-6 md:w-6 text-brand-primary mb-2" />
              <span className="text-sm md:text-base font-medium text-gray-900">{t('quickActions.generate')}</span>
            </button>
            <button 
              onClick={() => router.push('/app/contexts')}
              className="flex items-center justify-center px-4 py-4 md:px-6 md:py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[88px] md:min-h-0"
            >
              <DocumentTextIcon className="h-7 w-7 md:h-6 md:w-6 text-brand-primary mr-2 md:mr-3" />
              <span className="text-sm md:text-base font-medium text-gray-900">{t('quickActions.createTemplate')}</span>
            </button>
            {userPermissions.isTeamAdmin && (
              <button 
                onClick={() => router.push('/app/team')}
                className="flex items-center justify-center px-4 py-4 md:px-6 md:py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[88px] md:min-h-0"
              >
                <UsersIcon className="h-7 w-7 md:h-6 md:w-6 text-brand-primary mr-2 md:mr-3" />
                <span className="text-sm md:text-base font-medium text-gray-900">{t('quickActions.manageTeam')}</span>
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
