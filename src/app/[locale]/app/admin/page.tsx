'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { 
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  PaintBrushIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CreditCardIcon,
  UserGroupIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import FreePackageStyleAdminPanel from '../settings/FreePackageStyleAdminPanel'
import { jsonFetcher } from '@/lib/fetcher'

interface SummaryData {
  totalUsers: number
  paidUsers: number
  totalTeamInvites: number
  acceptedInvites: number
  activeTeams: number
  creditsPurchased: number
  creditsUsed: number
  lastUpdated: string
}

// User search component for impersonation
function UserSearchImpersonation({ onStartImpersonation, disabled }: { onStartImpersonation: (userId: string) => Promise<void>, disabled: boolean }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{id: string, displayName: string}>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{id: string, displayName: string} | null>(null)
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)
  const t = useTranslations('admin')

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/admin/search-users?query=${encodeURIComponent(searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.users || [])
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-purple-800 mb-2">
          {t('impersonation.searchUser')}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('impersonation.searchPlaceholder')}
            className="block w-full px-3 py-2 border border-purple-300 rounded-md shadow-sm bg-white text-gray-900 placeholder:text-gray-500 transition-all duration-200 hover:border-purple-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
          {isSearching && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full"></div>
            </div>
          )}
          
          {searchResults.length > 0 && !selectedUser && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-purple-200 rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                >
                  <span className="text-sm text-gray-900">{user.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">{t('impersonation.selected')}: {selectedUser.displayName}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-purple-600 hover:text-purple-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 p-3 bg-purple-100 border border-purple-200 rounded-lg">
          <p className="text-xs text-purple-800 font-medium">
            ⚠️ {t('impersonation.warning')}
          </p>
        </div>
      </div>
      <button
        onClick={() => selectedUser && onStartImpersonation(selectedUser.id)}
        disabled={!selectedUser || disabled}
        className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-purple-700 hover:bg-purple-50 border-2 border-purple-300 transition-all duration-200 hover:border-purple-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {disabled ? t('impersonation.starting') : t('impersonation.start')}
      </button>
    </div>
  )
}

// Role display badge component
function RoleDisplayBadge() {
  const { data: session } = useSession()
  const [roleDisplay, setRoleDisplay] = useState<string>('Loading...')
  const [needsTeamSetup, setNeedsTeamSetup] = useState(false)
  const t = useTranslations('admin')

  useEffect(() => {
    const fetchRole = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/dashboard/stats')
          if (response.ok) {
            const data = await response.json()
            const { isTeamAdmin, isTeamMember, needsTeamSetup: setupNeeded } = data.userRole || {}
            
            setNeedsTeamSetup(setupNeeded || false)
            
            if (isTeamAdmin) {
              setRoleDisplay(setupNeeded ? t('roles.teamAdminNoTeam') : t('roles.teamAdmin'))
            } else if (isTeamMember) {
              setRoleDisplay(t('roles.teamMember'))
            } else {
              setRoleDisplay(t('roles.individualUser'))
            }
          } else {
            setRoleDisplay(t('roles.individualUser'))
          }
        } catch {
          setRoleDisplay(t('roles.individualUser'))
        }
      }
    }
    fetchRole()
  }, [session?.user?.id, t])

  return (
    <>
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {roleDisplay}
      </span>
      {needsTeamSetup && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            💡 {t('roles.teamSetupHint')}{' '}
            <Link href="/app/team" className="underline hover:no-underline">{t('roles.goToTeam')}</Link>
          </p>
        </div>
      )}
    </>
  )
}

export default function AdminPage() {
  const { data: session } = useSession()
  const t = useTranslations('admin')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'overview' | 'freeStyle' | 'tools'>('overview')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await jsonFetcher<SummaryData>('/api/admin/summary')
        setSummary(data)
      } catch (err) {
        console.error('Failed to fetch admin summary:', err)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.isAdmin) {
      fetchSummary()
    } else {
      setLoading(false)
    }
  }, [session?.user?.isAdmin])

  const refreshSession = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      const data = await jsonFetcher<{ debug?: { databaseRole?: string } }>('/api/user/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (data.debug?.databaseRole !== session?.user?.role) {
        setSuccess(t('tools.sessionMismatch', { dbRole: data.debug?.databaseRole ?? 'unknown', sessionRole: session?.user?.role ?? 'unknown' }))
      } else {
        setSuccess(t('tools.sessionUpToDate', { role: data.debug?.databaseRole ?? 'unknown' }))
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      console.error('Failed to refresh session:', err)
      setError(t('tools.refreshFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (newRole: 'user' | 'team_admin') => {
    if (!session?.user?.isAdmin) {
      setError(t('tools.onlyAdminsCanChangeRoles'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await jsonFetcher('/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: session.user.id,
          newRole: newRole
        })
      })

      setSuccess(t('tools.roleChanged', { role: newRole }))
    } catch (e) {
      const errorData = (e as { message?: string })
      setError(errorData?.message || t('tools.roleChangeFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Note: Middleware handles redirect for non-admins, but we still show loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
          {t('subtitle')}
        </p>
        {summary?.lastUpdated && (
          <p className="text-sm text-gray-500 mt-2">
            {t('lastUpdated')}: {new Date(summary.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-brand-secondary-light border border-brand-secondary-lighter rounded-lg p-4 shadow-sm">
          <div className="flex items-start">
            <CheckIcon className="h-5 w-5 text-brand-secondary mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-brand-secondary-text-light leading-relaxed">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-red-800 leading-relaxed font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UsersIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">{t('stats.totalUsers')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary?.totalUsers?.toLocaleString() || '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{summary?.paidUsers || 0} {t('stats.paid')}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCardIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">{t('stats.creditsPurchased')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary?.creditsPurchased?.toLocaleString() || '—'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">{t('stats.creditsUsed')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary?.creditsUsed?.toLocaleString() || '—'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">{t('stats.teamInvites')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary?.totalTeamInvites?.toLocaleString() || '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{summary?.acceptedInvites || 0} {t('stats.accepted')}</p>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('quickAccess.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/app/admin/analytics"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-primary/30 transition-all group"
          >
            <div className="p-3 bg-brand-primary-light rounded-xl group-hover:bg-brand-primary-lighter transition-colors">
              <ChartBarIcon className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-primary transition-colors">{t('quickAccess.analytics')}</h3>
              <p className="text-sm text-gray-500">{t('quickAccess.analyticsDesc')}</p>
            </div>
          </Link>

          <Link 
            href="/app/admin/feedback"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-primary/30 transition-all group"
          >
            <div className="p-3 bg-brand-primary-light rounded-xl group-hover:bg-brand-primary-lighter transition-colors">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-primary transition-colors">{t('quickAccess.feedback')}</h3>
              <p className="text-sm text-gray-500">{t('quickAccess.feedbackDesc')}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setActiveSection('overview')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                activeSection === 'overview' 
                  ? 'bg-red-600 text-white' 
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <WrenchScrewdriverIcon className="h-4 w-4 inline mr-2" />
              {t('sections.adminTools')}
            </button>
            <button
              onClick={() => setActiveSection('freeStyle')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all border-l border-gray-200 ${
                activeSection === 'freeStyle' 
                  ? 'bg-red-600 text-white' 
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <PaintBrushIcon className="h-4 w-4 inline mr-2" />
              {t('sections.freeStyle')}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Tools Section */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Role Management */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow-sm p-6 sm:p-8">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold mr-3">
                {t('badge')}
              </div>
              <h2 className="text-xl font-semibold text-red-900">{t('tools.roleManagement')}</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              {t('tools.roleManagementDesc')}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-red-800 mb-2">
                  {t('tools.currentRole')}
                </label>
                <div className="flex items-center space-x-2">
                  <RoleDisplayBadge />
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {t('tools.platformAdmin')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-red-900 mb-3">
                  {t('tools.changeRoleTitle')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {session?.user?.role === 'team_admin' ? (
                    <button
                      onClick={() => handleRoleChange('user')}
                      disabled={saving}
                      className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-red-700 hover:bg-red-50 border-2 border-red-300 transition-all duration-200 hover:border-red-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('tools.setAsIndividual')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRoleChange('team_admin')}
                      disabled={saving}
                      className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-red-700 hover:bg-red-50 border-2 border-red-300 transition-all duration-200 hover:border-red-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('tools.setAsTeamAdmin')}
                    </button>
                  )}
                </div>
                <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800 font-medium">
                    ⚠️ {t('tools.roleChangeWarning')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-red-900 mb-3">
                  {t('tools.sessionManagement')}
                </label>
                <button
                  onClick={refreshSession}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-semibold text-red-700 bg-white border-2 border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 hover:border-red-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('tools.refreshing') : t('tools.refreshSession')}
                </button>
                <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800 font-medium">
                    💡 {t('tools.refreshSessionHint')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Impersonation */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg shadow-sm p-6 sm:p-8">
            <div className="flex items-center mb-4">
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold mr-3">
                {t('impersonation.badge')}
              </div>
              <h2 className="text-xl font-semibold text-purple-900">{t('impersonation.title')}</h2>
            </div>
            <p className="text-sm text-purple-700 mb-4">
              {t('impersonation.description')}
            </p>
            
            {session?.user?.impersonating ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-yellow-900 font-semibold leading-relaxed">
                    ⚠️ <strong>{t('impersonation.currentlyImpersonating')}</strong>
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const response = await fetch('/api/admin/impersonate', {
                        method: 'DELETE'
                      })
                      if (response.ok) {
                        setSuccess(t('impersonation.stopped'))
                        setTimeout(() => {
                          window.location.href = '/app/dashboard'
                        }, 1000)
                      } else {
                        const data = await response.json()
                        setError(data.error || t('impersonation.stopFailed'))
                      }
                    } catch {
                      setError(t('impersonation.stopFailed'))
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-white text-purple-700 hover:bg-purple-50 border-2 border-purple-300 transition-all duration-200 hover:border-purple-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('impersonation.stopping') : t('impersonation.stop')}
                </button>
              </div>
            ) : (
              <UserSearchImpersonation 
                onStartImpersonation={async (userId) => {
                  setSaving(true)
                  try {
                    const response = await fetch(`/api/admin/impersonate?userId=${userId}`)
                    if (response.ok) {
                      setSuccess(t('impersonation.started'))
                      setTimeout(() => {
                        window.location.href = '/app/dashboard'
                      }, 1000)
                    } else {
                      const data = await response.json()
                      setError(data.error || t('impersonation.startFailed'))
                    }
                  } catch {
                    setError(t('impersonation.startFailed'))
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              />
            )}
          </div>
        </div>
      )}

      {/* Free Style Section */}
      {activeSection === 'freeStyle' && (
        <FreePackageStyleAdminPanel />
      )}
    </div>
  )
}

