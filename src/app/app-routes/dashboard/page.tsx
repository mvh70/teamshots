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

export default function DashboardPage() {
  const { data: session } = useSession()
  const t = useTranslations('app.dashboard')

  const stats = [
    {
      name: t('stats.teamMembers'),
      value: '12',
      change: '+2',
      changeType: 'increase',
      icon: UsersIcon,
    },
    {
      name: t('stats.photosGenerated'),
      value: '48',
      change: '+12',
      changeType: 'increase',
      icon: PhotoIcon,
    },
    {
      name: t('stats.activeTemplates'),
      value: '5',
      change: '+1',
      changeType: 'increase',
      icon: DocumentTextIcon,
    },
    {
      name: t('stats.creditsUsed'),
      value: '192',
      change: '+48',
      changeType: 'increase',
      icon: ChartBarIcon,
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'generation',
      user: 'Sarah Johnson',
      action: 'generated new headshot',
      time: '2 minutes ago',
      status: 'completed',
    },
    {
      id: 2,
      type: 'invitation',
      user: 'Mike Chen',
      action: 'joined the team',
      time: '1 hour ago',
      status: 'completed',
    },
    {
      id: 3,
      type: 'template',
      user: 'You',
      action: 'created new template "Executive Style"',
      time: '3 hours ago',
      status: 'completed',
    },
    {
      id: 4,
      type: 'generation',
      user: 'Emily Davis',
      action: 'uploaded photo for review',
      time: '5 hours ago',
      status: 'pending',
    },
  ]

  const pendingInvites = [
    {
      id: 1,
      email: 'alex@company.com',
      name: 'Alex Rodriguez',
      sent: '2 days ago',
      status: 'pending',
    },
    {
      id: 2,
      email: 'lisa@company.com',
      name: 'Lisa Wang',
      sent: '1 day ago',
      status: 'pending',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-brand-primary to-brand-primary-hover rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          {t('welcome.title', {name: session?.user?.name || 'Admin'})}
        </h2>
        <p className="text-brand-primary-light">
          {t('welcome.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
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
                    stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('recentActivity.title')}</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {activity.status === 'completed' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ClockIcon className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Invites */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Pending Team Invites</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invite.name}</p>
                    <p className="text-xs text-gray-500">{invite.email}</p>
                    <p className="text-xs text-gray-400">{t('recentActivity.sent', {when: invite.sent})}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary">
                      {t('recentActivity.status.pending')}
                    </span>
                    <button className="text-brand-primary hover:text-brand-primary-hover text-sm font-medium">
                      {t('pendingInvites.resend')}
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-gray-200">
                <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  {t('pendingInvites.invite')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{t('quickActions.title')}</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <PhotoIcon className="h-6 w-6 text-brand-primary mr-3" />
              <span className="text-sm font-medium text-gray-900">{t('quickActions.generate')}</span>
            </button>
            <button className="flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <DocumentTextIcon className="h-6 w-6 text-brand-primary mr-3" />
              <span className="text-sm font-medium text-gray-900">{t('quickActions.createTemplate')}</span>
            </button>
            <button className="flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <UsersIcon className="h-6 w-6 text-brand-primary mr-3" />
              <span className="text-sm font-medium text-gray-900">{t('quickActions.manageTeam')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
