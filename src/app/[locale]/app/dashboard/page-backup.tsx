'use client'

import { useSession } from 'next-auth/react'
import { 
  UsersIcon, 
  PhotoIcon, 
  DocumentTextIcon, 
  ChartBarIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import {useTranslations} from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/routing'
import { useEffect, useState } from 'react'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

interface DashboardStats {
  photosGenerated: number
  activeTemplates: number
  creditsUsed: number
  teamMembers: number
}

interface UserRole {
  isTeamAdmin: boolean
  isTeamMember: boolean
  isRegularUser: boolean
  teamId?: string
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
  const [userRole, setUserRole] = useState<UserRole>({
    isTeamAdmin: false,
    isTeamMember: false,
    isRegularUser: true
  })
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])

  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // Fetch stats
        const statsResponse = await fetch('/api/dashboard/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData.stats)
          setUserRole(statsData.userRole)
        }

        // Fetch recent activity
        const activityResponse = await fetch('/api/dashboard/activity')
        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          setRecentActivity(activityData.activities)
        }

        // Fetch pending invites (only for team admins)
        if (userRole.isTeamAdmin) {
          const invitesResponse = await fetch('/api/dashboard/pending-invites')
          if (invitesResponse.ok) {
            const invitesData = await invitesResponse.json()
            setPendingInvites(invitesData.pendingInvites)
          }
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchDashboardData()
    }
  }, [session?.user?.id, userRole.isTeamAdmin])

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
      const response = await fetch('/api/team/invites/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId })
      })

      const data = await response.json()

      if (response.ok) {
        // Refresh pending invites
        const invitesResponse = await fetch('/api/dashboard/pending-invites')
        if (invitesResponse.ok) {
          const invitesData = await invitesResponse.json()
          setPendingInvites(invitesData.pendingInvites)
        }
      } else {
        console.error('Failed to resend invite:', data.error)
      }
    } catch (error) {
      console.error('Failed to resend invite:', error)
    } finally {
      setResending(null)
    }
  }

  const statsConfig = [
    ...(userRole.isTeamAdmin ? [{
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
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-brand-primary to-brand-primary-hover rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          {t('welcome.title', {name: firstName})}
        </h2>
        <p className="text-brand-primary-light">
          {loading ? (
            <span className="animate-pulse">Loading your stats...</span>
          ) : userRole.isTeamAdmin ? (
            t('welcome.subtitle.teamAdmin', {
              count: stats.photosGenerated,
              teamMembers: stats.teamMembers
            })
          ) : userRole.isTeamMember ? (
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
      <div className={`grid grid-cols-1 md:grid-cols-2 ${userRole.isTeamAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        {loading ? (
          // Loading skeleton
          Array.from({ length: userRole.isTeamAdmin ? 4 : 3 }).map((_, index) => (
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
            <div key={stat.name} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
                    <stat.icon className="h-5 w-5 text-brand-primary" />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    <p className={`ml-2 text-sm font-medium ${
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity - Only for Team Admins */}
        {userRole.isTeamAdmin && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{t('recentActivity.title')}</h3>
            </div>
            <div className="p-6">
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
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {activity.status === 'completed' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : activity.status === 'processing' ? (
                          <ClockIcon className="h-5 w-5 text-blue-500" />
                        ) : (
                          <ClockIcon className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                          {/* Generation type indicator */}
                          {activity.generationType && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              activity.generationType === 'personal' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {activity.generationType === 'personal' ? t('recentActivity.generationType.personal') : t('recentActivity.generationType.team')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(activity.time)}</p>
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
        {userRole.isTeamAdmin && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{t('pendingInvites.title')}</h3>
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
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{t('quickActions.title')}</h3>
        </div>
        <div className="p-6">
          <div className={`grid grid-cols-1 ${userRole.isTeamAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
            <div className="flex flex-col items-stretch justify-center px-4 py-4 border border-gray-300 rounded-lg">
              <div className="flex items-center justify-center mb-3">
                <PhotoIcon className="h-6 w-6 text-brand-primary mr-3" />
                <span className="text-sm font-medium text-gray-900">{t('quickActions.generate')}</span>
              </div>
              <PhotoUpload
                onSelect={() => {}}
                onUploaded={({ key }) => {
                  router.push(`/app/generate/start?key=${encodeURIComponent(key)}`)
                }}
              />
            </div>
            <button 
              onClick={() => router.push('/app/contexts')}
              className="flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <DocumentTextIcon className="h-6 w-6 text-brand-primary mr-3" />
              <span className="text-sm font-medium text-gray-900">{t('quickActions.createTemplate')}</span>
            </button>
            {userRole.isTeamAdmin && (
              <button 
                onClick={() => router.push('/app/team')}
                className="flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <UsersIcon className="h-6 w-6 text-brand-primary mr-3" />
                <span className="text-sm font-medium text-gray-900">{t('quickActions.manageTeam')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
