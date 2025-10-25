'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { 
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import SubscriptionSection from '@/components/settings/SubscriptionSection'

interface UserSettings {
  mode: 'individual' | 'company'
  companyName?: string
  companyWebsite?: string
  isAdmin?: boolean
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const t = useTranslations('app.settings')
  const [settings, setSettings] = useState<UserSettings>({ mode: 'individual' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchUserSettings()
  }, [])

  const fetchUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshSession = async () => {
    console.log('Refresh session button clicked')
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      console.log('Making API call to refresh session...')
      // Get fresh user data from the database
      const response = await fetch('/api/user/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      console.log('API response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Fresh database data:', data)
        
        if (data.debug?.databaseRole !== session?.user?.role) {
          setSuccess(`⚠️ Session mismatch detected! Database: ${data.debug?.databaseRole}, Session: ${session?.user?.role}. Please sign out using the profile menu in the sidebar and sign back in.`)
        } else {
          setSuccess(`✅ Session is up to date. Database role: ${data.debug?.databaseRole}`)
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        }
      } else {
        const errorData = await response.json()
        console.error('API error:', errorData)
        setError(errorData.error || 'Failed to refresh session')
      }
    } catch (err) {
      console.error('Failed to refresh session:', err)
      setError('Failed to refresh session')
    } finally {
      setSaving(false)
    }
  }

  const handleCompanyInfoUpdate = async (field: string, value: string) => {
    if (settings.mode !== 'company') return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: settings.mode,
          [field]: value
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        setSuccess('Company information updated')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update company information')
      }
    } catch {
      setError('Failed to update company information')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (newRole: 'user' | 'company_admin') => {
    if (!session?.user?.isAdmin) {
      setError('Only platform administrators can change roles')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: session.user.id,
          newRole: newRole
        })
      })

      if (response.ok) {
        await response.json()
        setSuccess(`Role changed to ${newRole}. Please sign out and sign back in to see the changes.`)
        // Don't auto-reload since session won't update automatically
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to change role')
      }
    } catch {
      setError('Failed to change role')
    } finally {
      setSaving(false)
    }
  }

  const handleTeamRoleChange = async (newRole: 'company_member' | 'company_admin') => {
    if (!session?.user?.person?.companyId) {
      setError('You must be part of a company to change team roles')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/team/members/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: session.user.id,
          role: newRole
        })
      })

      if (response.ok) {
        setSuccess(`Team role changed to ${newRole}. Page will reload to reflect changes.`)
        // Reload the page to update the session and sidebar
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to change team role')
      }
    } catch {
      setError('Failed to change team role')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">
          {t('subtitle')}
        </p>
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


      {/* Company Information (only shown in company mode) */}
      {settings.mode === 'company' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('companyInfo.title')}</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('companyInfo.name.label')}
              </label>
              <input
                type="text"
                id="companyName"
                value={settings.companyName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                onBlur={(e) => handleCompanyInfoUpdate('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                placeholder={t('companyInfo.name.placeholder')}
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                {t('companyInfo.website.label')}
              </label>
              <input
                type="url"
                id="companyWebsite"
                value={settings.companyWebsite || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, companyWebsite: e.target.value }))}
                onBlur={(e) => handleCompanyInfoUpdate('companyWebsite', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                placeholder={t('companyInfo.website.placeholder')}
                disabled={saving}
              />
            </div>
          </div>

          {settings.isAdmin && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <CheckIcon className="h-5 w-5 text-blue-400 mr-2" />
                <span className="text-sm text-blue-800">
                  {t('companyInfo.adminNote')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Subscription & Billing */}
      <SubscriptionSection userId={session?.user?.id || ''} />

      {/* TEAM ROLE MANAGEMENT SECTION - FOR COMPANY MEMBERS */}
      {session?.user?.person?.companyId && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold mr-3">
              [TEAM]
            </div>
            <h2 className="text-lg font-semibold text-purple-900">Team Role Management</h2>
          </div>
          <p className="text-sm text-purple-700 mb-4">
            Manage your role within your company team.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-purple-800 mb-2">
                Current Team Role
              </label>
              <div className="flex items-center space-x-2">
                {session?.user?.person?.company?.adminId === session?.user?.id ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Team Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Team Member
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-800 mb-2">
                Change Team Role
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleTeamRoleChange('company_member')}
                  disabled={saving}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    session?.user?.person?.company?.adminId !== session?.user?.id
                      ? 'bg-purple-200 text-purple-900'
                      : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-300'
                  } disabled:opacity-50`}
                >
                  Set as Team Member
                </button>
                <button
                  onClick={() => handleTeamRoleChange('company_admin')}
                  disabled={saving}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    session?.user?.person?.company?.adminId === session?.user?.id
                      ? 'bg-purple-200 text-purple-900'
                      : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-300'
                  } disabled:opacity-50`}
                >
                  Set as Team Admin
                </button>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                💡 This will change your role within your company team.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ROLE MANAGEMENT SECTION - ADMIN ONLY */}
      {session?.user?.isAdmin === true && (
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
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {session?.user?.role === 'company_admin' && session?.user?.person?.companyId && session?.user?.person?.company?.adminId === session?.user?.id
                    ? 'Team Admin' 
                    : session?.user?.role === 'company_admin' && !session?.user?.person?.companyId
                      ? 'Team Admin (No Company)'
                      : session?.user?.person?.companyId && session?.user?.person?.company?.adminId !== session?.user?.id
                        ? 'Team Member'
                        : 'Individual User'
                  }
                </span>
                {session?.user?.isAdmin && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Platform Admin
                  </span>
                )}
              </div>
              {session?.user?.role === 'company_admin' && !session?.user?.person?.companyId && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    💡 You&apos;re a Team Admin but haven&apos;t set up a company yet. 
                    <Link href="/app/team" className="underline hover:no-underline">Go to Team page</Link> to create or join a company.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-red-800 mb-2">
                Change Role (Testing Only)
              </label>
              <div className="flex space-x-2">
                {session?.user?.role === 'company_admin' ? (
                  <button
                    onClick={() => handleRoleChange('user')}
                    disabled={saving}
                    className="px-3 py-2 text-sm font-medium rounded-md bg-white text-red-700 hover:bg-red-50 border border-red-300 disabled:opacity-50"
                  >
                    Set as Individual User
                  </button>
                ) : (
                  <button
                    onClick={() => handleRoleChange('company_admin')}
                    disabled={saving}
                    className="px-3 py-2 text-sm font-medium rounded-md bg-white text-red-700 hover:bg-red-50 border border-red-300 disabled:opacity-50"
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

      {/* Account Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('accountInfo.title')}</h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('accountInfo.email')}</label>
            <p className="text-sm text-gray-900 mt-1">{session?.user?.email}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('accountInfo.name')}</label>
            <p className="text-sm text-gray-900 mt-1">{session?.user?.name || t('accountInfo.notProvided')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('accountInfo.userId')}</label>
            <p className="text-sm text-gray-500 font-mono mt-1">{session?.user?.id}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('accountInfo.currentRoles')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {session?.user?.isAdmin && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {t('roles.platformAdmin')}
                </span>
              )}
              {session?.user?.person?.company?.adminId === session?.user?.id && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {t('roles.companyAdmin')}
                </span>
              )}
              {session?.user?.person?.companyId && session?.user?.person?.company?.adminId !== session?.user?.id && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {t('roles.teamMember')}
                </span>
              )}
              {session?.user?.role === 'user' && !session?.user?.person?.companyId && (
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
    </div>
  )
}
