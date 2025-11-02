'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { 
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import StripeNotice from '@/components/stripe/StripeNotice'
import SubscriptionSection from '@/components/settings/SubscriptionSection'
import BillingSection from '@/components/settings/BillingSection'
import FreePackageStyleAdminPanel from './FreePackageStyleAdminPanel'
import { jsonFetcher } from '@/lib/fetcher'

interface UserSettings {
  mode: 'individual' | 'team'
  teamName?: string
  teamWebsite?: string
  isAdmin?: boolean
}

// Component to display user role badge using effective roles
function RoleDisplayBadge() {
  const { data: session } = useSession()
  const [roleDisplay, setRoleDisplay] = useState<string>('Loading...')
  const [needsTeamSetup, setNeedsTeamSetup] = useState(false)

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
              setRoleDisplay(setupNeeded ? 'Team Admin (No Team)' : 'Team Admin')
            } else if (isTeamMember) {
              setRoleDisplay('Team Member')
            } else {
              setRoleDisplay('Individual User')
            }
          } else {
            setRoleDisplay('Individual User')
          }
        } catch {
          setRoleDisplay('Individual User')
        }
      }
    }
    fetchRole()
  }, [session?.user?.id])

  return (
    <>
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {roleDisplay}
      </span>
      {needsTeamSetup && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            💡 You&apos;re a Team Admin but haven&apos;t set up a team yet. 
            <Link href="/app/team" className="underline hover:no-underline">Go to Team page</Link> to create or join a team.
          </p>
        </div>
      )}
    </>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const t = useTranslations('app.settings')
  const [settings, setSettings] = useState<UserSettings>({ mode: 'individual' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'team' | 'subscription' | 'billing' | 'admin' | 'account' | 'freeStyle'>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('settings-active-tab')
      if (savedTab && ['team', 'subscription', 'billing', 'admin', 'account', 'freeStyle'].includes(savedTab)) {
        return savedTab as 'team' | 'subscription' | 'billing' | 'admin' | 'account' | 'freeStyle'
      }
    }
    return 'subscription'
  })
  const [userRoles, setUserRoles] = useState<{ isTeamAdmin: boolean; isPlatformAdmin: boolean }>({ isTeamAdmin: false, isPlatformAdmin: false })
  
  // Persist tab selection to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('settings-active-tab', activeTab)
    }
  }, [activeTab])
  
  // Fetch effective roles from API (respects pro subscription = team admin)
  useEffect(() => {
    const fetchRoles = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/dashboard/stats')
          if (response.ok) {
            const data = await response.json()
            setUserRoles({
              isTeamAdmin: data.userRole?.isTeamAdmin ?? false,
              isPlatformAdmin: session?.user?.isAdmin ?? false
            })
          }
        } catch {
          // Fallback to session data (doesn't account for pro subscription, but better than nothing)
          setUserRoles({
            isTeamAdmin: (session?.user?.person?.team?.adminId === session?.user?.id) || false,
            isPlatformAdmin: session?.user?.isAdmin || false
          })
        }
      }
    }
    fetchRoles()
  }, [session?.user?.id, session?.user?.person?.team?.adminId, session?.user?.isAdmin])
  
  const isTeamAdmin = userRoles.isTeamAdmin
  const isPlatformAdmin = userRoles.isPlatformAdmin
  
  // Check if user needs to purchase
  const needsPurchase = searchParams.get('purchase') === 'required'

  useEffect(() => {
    fetchUserSettings()
    
    // If user needs to purchase, switch to subscription tab
    if (needsPurchase) {
      setActiveTab('subscription')
    }
    
    // Ensure non team_admin users don't land on the team tab
    // Use the effective role from state (includes pro subscription check)
    if (!userRoles.isTeamAdmin && activeTab === 'team') {
      setActiveTab('account')
    }
  }, [needsPurchase, session, activeTab, userRoles.isTeamAdmin])

  // If success present, show subscription tab so banner is contextually relevant
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setActiveTab('subscription')
    }
  }, [searchParams])

  const fetchUserSettings = async () => {
    try {
      const data = await jsonFetcher<{ settings: UserSettings }>('/api/user/settings')
      setSettings(data.settings)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshSession = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      // Get fresh user data from the database
      const data = await jsonFetcher<{ debug?: { databaseRole?: string } }>('/api/user/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (data.debug?.databaseRole !== session?.user?.role) {
        setSuccess(`⚠️ Session mismatch detected! Database: ${data.debug?.databaseRole}, Session: ${session?.user?.role}. Please sign out using the profile menu in the sidebar and sign back in.`)
      } else {
        setSuccess(`✅ Session is up to date. Database role: ${data.debug?.databaseRole}`)
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      console.error('Failed to refresh session:', err)
      setError('Failed to refresh session')
    } finally {
      setSaving(false)
    }
  }

  const handleTeamInfoUpdate = async (field: string, value: string) => {
    if (settings.mode !== 'team') return

    setSaving(true)
    setError(null)

    try {
      const data = await jsonFetcher<{ settings: UserSettings }>('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: settings.mode,
          [field]: value
        })
      })

      setSettings(data.settings)
      setSuccess('Team information updated')
    } catch (e) {
      try {
        const errorData = (e as { message?: string })
        setError(errorData?.message || 'Failed to update team information')
      } catch {
        setError('Failed to update team information')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (newRole: 'user' | 'team_admin') => {
    if (!session?.user?.isAdmin) {
      setError('Only platform administrators can change roles')
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

      setSuccess(`Role changed to ${newRole}. Please sign out and sign back in to see the changes.`)
      // Don't auto-reload since session won't update automatically
    } catch (e) {
      try {
        const errorData = (e as { message?: string })
        setError(errorData?.message || 'Failed to change role')
      } catch {
        setError('Failed to change role')
      }
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">
          {t('subtitle')}
        </p>
      </div>

      {/* Stripe notices */}
      <StripeNotice className="mb-6" />

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white">
          {isTeamAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border-r border-gray-200 ${activeTab === 'team' ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {t('tabs.teamInformation')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-2 text-sm font-medium border-r border-gray-200 ${activeTab === 'subscription' ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {t('tabs.subscription')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 text-sm font-medium border-r border-gray-200 ${activeTab === 'billing' ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {t('tabs.billing')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2 text-sm font-medium ${isPlatformAdmin ? 'border-r border-gray-200' : 'rounded-r-lg'} ${activeTab === 'account' ? 'bg-brand-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {t('tabs.accountInfo')}
          </button>
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-sm font-medium border-r border-gray-200 ${activeTab === 'admin' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'}`}
            >
              {t('tabs.adminTools')}
            </button>
          )}
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('freeStyle')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${activeTab === 'freeStyle' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'}`}
            >
              Free Plan Style
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <CheckIcon className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}


      {/* Team Information - visible only to team_admins */}
      {activeTab === 'team' && settings.mode === 'team' && session?.user?.person?.team?.adminId === session?.user?.id && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('teamInfo.title')}</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('teamInfo.name.label')}
              </label>
              <input
                type="text"
                id="teamName"
                value={settings.teamName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, teamName: e.target.value }))}
                onBlur={(e) => handleTeamInfoUpdate('teamName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                placeholder={t('teamInfo.name.placeholder')}
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="teamWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                {t('teamInfo.website.label')}
              </label>
              <input
                type="url"
                id="teamWebsite"
                value={settings.teamWebsite || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, teamWebsite: e.target.value }))}
                onBlur={(e) => handleTeamInfoUpdate('teamWebsite', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                placeholder={t('teamInfo.website.placeholder')}
                disabled={saving}
              />
            </div>
          </div>

          {settings.isAdmin && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <CheckIcon className="h-5 w-5 text-blue-400 mr-2" />
                <span className="text-sm text-blue-800">
                  {t('teamInfo.adminNote')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription */}
      {activeTab === 'subscription' && (
        <SubscriptionSection 
          userId={session?.user?.id || ''}
          userMode={settings.mode}
        />
      )}

      {/* Billing */}
      {activeTab === 'billing' && (
        <BillingSection 
          userId={session?.user?.id || ''}
        />
      )}


      {/* ADMIN ROLE MANAGEMENT SECTION - ADMIN ONLY */}
      {activeTab === 'admin' && session?.user?.isAdmin === true && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold mr-3">
              [ADMIN]
            </div>
            <h2 className="text-lg font-semibold text-red-900">Admin Role Management</h2>
          </div>
          <p className="text-sm text-red-700 mb-4">
            This section is only visible to platform administrators. Use with caution for testing purposes.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-800 mb-2">
                Current User Role
              </label>
              <div className="flex items-center space-x-2">
                <RoleDisplayBadge />
                {isPlatformAdmin && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Platform Admin
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-red-800 mb-2">
                Change Role (Testing Only)
              </label>
              <div className="flex space-x-2">
                {session?.user?.role === 'team_admin' ? (
                  <button
                    onClick={() => handleRoleChange('user')}
                    disabled={saving}
                    className="px-3 py-2 text-sm font-medium rounded-md bg:white text-red-700 hover:bg-red-50 border border-red-300 disabled:opacity-50"
                  >
                    Set as Individual User
                  </button>
                ) : (
                  <button
                    onClick={() => handleRoleChange('team_admin')}
                    disabled={saving}
                    className="px-3 py-2 text-sm font-medium rounded-md bg:white text-red-700 hover:bg-red-50 border border-red-300 disabled:opacity-50"
                  >
                    Set as Team Admin
                  </button>
                )}
              </div>
              <p className="text-xs text-red-600 mt-1">
                ⚠️ This will change your role immediately. Use for testing only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-red-800 mb-2">
                Session Management
              </label>
              <button
                onClick={refreshSession}
                disabled={saving}
                className="px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '🔄 Refreshing...' : '🔄 Refresh Session Data'}
              </button>
              <p className="text-xs text-red-600 mt-1">
                💡 Refresh your session to see updated role information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN: Free Package Style Designer */}
      {activeTab === 'freeStyle' && session?.user?.isAdmin === true && (
        <FreePackageStyleAdminPanel />
      )}

      {/* Account Information */}
      {activeTab === 'account' && (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('accountInfo.title')}</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            {t('accountInfo.intro', { default: "🛟 You probably won't need this info unless something's gone sideways and support asks for it. But just in case, here it is!" })}
          </p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('accountInfo.email')}</label>
            <p className="text-sm text-gray-900 mt-1">{session?.user?.email}</p>
          </div>
          
          <div>
            <label className="block text.sm font-medium text-gray-700">{t('accountInfo.name')}</label>
            <p className="text-sm text-gray-900 mt-1">{session?.user?.name || t('accountInfo.notProvided')}</p>
          </div>

          <div>
            <label className="block text.sm font-medium text-gray-700">{t('accountInfo.userId')}</label>
            <p className="text-sm text-gray-500 font-mono mt-1">{session?.user?.id}</p>
          </div>

          <div>
            <label className="block text.sm font-medium text-gray-700">{t('accountInfo.currentRoles')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {session?.user?.isAdmin && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {t('roles.platformAdmin')}
                </span>
              )}
              {session?.user?.person?.team?.adminId === session?.user?.id && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {t('roles.teamAdmin')}
                </span>
              )}
              {session?.user?.person?.teamId && session?.user?.person?.team?.adminId !== session?.user?.id && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {t('roles.teamMember')}
                </span>
              )}
              {session?.user?.role === 'user' && !session?.user?.person?.teamId && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {t('roles.individualUser')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('accountInfo.rolesDescription')}
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
