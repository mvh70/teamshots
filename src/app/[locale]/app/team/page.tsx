'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import { formatDate } from '@/lib/format'
import { Link } from '@/i18n/routing'
import { PlusIcon, EnvelopeIcon, ClockIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PRICING_CONFIG } from '@/config/pricing'
import { useCredits } from '@/contexts/CreditsContext'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import StyleCard from '@/components/styles/StyleCard'

interface TeamInvite {
  id: string
  email: string
  token: string
  expiresAt: string
  usedAt?: string
  creditsAllocated: number
  creditsUsed?: number
  creditsRemaining?: number
  createdAt: string
  contextId?: string
  contextName?: string
}

interface TeamData {
  id: string
  name: string
  activeContext?: {
    id: string
    name: string
  }
}

interface TeamMember {
  id: string
  name: string
  userId?: string
  email?: string
  isAdmin?: boolean
  isCurrentUser?: boolean
  stats?: {
    selfies: number
    generations: number
    individualCredits: number
    teamCredits: number
  }
}

export default function TeamPage() {
  const { data: session } = useSession()
  const t = useTranslations('team')
  const { credits } = useCredits()
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsTeamSetup, setNeedsTeamSetup] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<{
    isTeamAdmin: boolean
    isTeamMember: boolean
    isPlatformAdmin: boolean
  }>({
    isTeamAdmin: false,
    isTeamMember: false,
    isPlatformAdmin: false
  })
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [allocatedCredits, setAllocatedCredits] = useState<number>(PRICING_CONFIG.team.defaultInviteCredits)
  const [creditsInputValue, setCreditsInputValue] = useState(PRICING_CONFIG.team.defaultInviteCredits.toString())
  const [isFreePlan, setIsFreePlan] = useState(false)
  const [freePackageContext, setFreePackageContext] = useState<{ id: string; settings?: unknown; stylePreset?: string } | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/dashboard/stats')
          if (response.ok) {
            const data = await response.json()
            const { isTeamAdmin, isTeamMember, isPlatformAdmin, teamId, teamName, needsTeamSetup } = data.userRole

            setUserRoles({ isTeamAdmin, isTeamMember, isPlatformAdmin })

            if (isTeamAdmin) {
              if (needsTeamSetup) {
                setNeedsTeamSetup(true)
                setLoading(false)
              } else if (teamId && teamName) {
                setTeamData({ id: teamId, name: teamName })
                await fetchTeamData()
              } else {
                setLoading(false)
                setError('Could not retrieve team information.')
              }
            } else {
              setLoading(false) // Not an admin, will show admin-only message
            }
          } else {
            setLoading(false)
            setError('Failed to verify user role.')
          }
        } catch (err) {
          console.error('Failed to fetch user roles:', err)
          setLoading(false)
          setError('An error occurred while fetching user roles.')
        }
      } else {
        setLoading(false)
      }
    }
  
    fetchInitialData()
  }, [session?.user])

  const fetchTeamData = async () => {
    try {
      const [contextsData, invitesData, membersData] = await Promise.all([
        jsonFetcher<{ activeContext: { id: string; name: string } | undefined }>('/api/styles'),
        jsonFetcher<{ invites: TeamInvite[] }>('/api/team/invites'),
        jsonFetcher<{ users: TeamMember[] }>('/api/team/members')
      ])

      setTeamData(prevData => prevData ? { ...prevData, activeContext: contextsData.activeContext } : null)
      setInvites(invitesData.invites || [])
      setTeamMembers(membersData.users || [])
    } catch (error) {
      console.error('Team data fetch error:', error)
      setError('Failed to fetch team data: Network error')
    } finally {
      setLoading(false)
    }
  }

  // Check if user is on free plan and fetch free package context
  useEffect(() => {
    ;(async () => {
      if (!session?.user) return
      try {
        const subRes = await jsonFetcher<{ subscription: { period?: 'free' | 'try_once' | 'monthly' | 'annual' | null } | null }>('/api/user/subscription')
        const period = subRes?.subscription?.period ?? null
        const free = period === 'free'
        setIsFreePlan(free)
        if (free) {
          const freeData = await jsonFetcher<{ context: { id: string; settings?: unknown; stylePreset?: string } | null }>(
            '/api/styles/get?scope=freePackage'
          )
          setFreePackageContext(freeData.context || null)
        }
      } catch {
        // If subscription fetch fails, default to not-free to avoid blocking paid users
        setIsFreePlan(false)
      }
    })()
  }, [session?.user])

  const handleCreateTeam = async (formData: FormData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('teamName'),
          website: formData.get('teamWebsite')
        })
      })

      if (response.ok) {
        setNeedsTeamSetup(false)
        await fetchTeamData()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create team.')
      }
    } catch {
      setError('An error occurred while creating the team.')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteTeamMember = async (formData: FormData) => {
    setError(null)
    setInviteError(null)
    setSuccessMessage(null)
    setInviting(true)

    const email = formData.get('email') as string
    const firstName = formData.get('firstName') as string

    if (credits.team < allocatedCredits) {
      setInviteError(t('invites.insufficientCredits'))
      setInviting(false)
      return
    }

    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          creditsAllocated: allocatedCredits
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setShowInviteForm(false)
        setError(null)
        setSuccessMessage(t('inviteForm.success', { email }))
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        if (data.errorCode === 'NO_ACTIVE_CONTEXT') {
          setError(`${data.error} Click here to set up a context.`)
        } else {
          setError(data.error)
        }
      }
    } catch {
      setError('Failed to send invite')
    } finally {
      setInviting(false)
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
        setError(null)
        // TODO: Show success message
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to resend invite')
    } finally {
      setResending(null)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setRevoking(inviteId)
    try {
      const response = await fetch('/api/team/invites/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setError(null)
        // TODO: Show success message
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to revoke invite')
    } finally {
      setRevoking(null)
    }
  }

  const handleChangeMemberRole = async (memberId: string, newRole: 'team_member' | 'team_admin') => {
    setChangingRole(memberId)
    try {
      const response = await fetch('/api/team/members/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personId: memberId,
          role: newRole
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setError(null)
        // TODO: Show success message
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to change member role')
    } finally {
      setChangingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return
    }

    setRemoving(memberId)
    try {
      const response = await fetch('/api/team/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: memberId })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setError(null)
        // TODO: Show success message
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  const formatInviteDate = (dateString: string) => {
    return formatDate(dateString, 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (needsTeamSetup) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('setup.title')}</h2>
        <p className="mt-2 text-gray-600">{t('setup.subtitle')}</p>
        <form action={handleCreateTeam} className="mt-6 space-y-4 text-left">
          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700">
              {t('setup.teamNameLabel')}
            </label>
            <input
              type="text"
              name="teamName"
              id="teamName"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              placeholder={t('setup.teamNamePlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="teamWebsite" className="block text-sm font-medium text-gray-700">
              {t('setup.teamWebsiteLabel')}
            </label>
            <input
              type="url"
              name="teamWebsite"
              id="teamWebsite"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              placeholder={t('setup.teamWebsitePlaceholder')}
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          >
            {t('setup.createButton')}
          </button>
        </form>
      </div>
    )
  }

  // Show message if user is not a team admin
  if (!userRoles.isTeamAdmin && !loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('adminOnly.title')}</h3>
          <p className="text-gray-600 mb-6">
            {t('adminOnly.message')}
          </p>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          >
            {t('adminOnly.backToDashboard')}
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{teamData?.name || t('title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('subtitle')}
          </p>
        </div>
        {userRoles.isTeamAdmin && (
          <button
            onClick={() => setShowInviteForm(true)}
            disabled={(!teamData?.activeContext && !isFreePlan) || credits.team === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              (teamData?.activeContext || isFreePlan) && credits.team > 0
                ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            <PlusIcon className="h-5 w-5" />
            {t('buttons.inviteTeamMember')}
          </button>
        )}
      </div>

      {/* Setup Status */}
      {isFreePlan && !teamData?.activeContext ? (
        <div className="space-y-4">
          <FreePlanBanner variant="team" />
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckIcon className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Free Package Style Active
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
            <div className="rounded-lg border border-green-300 bg-white p-4">
              <StyleCard
                settings={freePackageContext?.settings}
                stylePreset={freePackageContext?.stylePreset || 'corporate'}
              />
            </div>
          </div>
        </div>
      ) : !teamData?.activeContext ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-yellow-800 font-medium">
              {t('setupRequired.title')}
            </span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            {t('setupRequired.message')}
          </p>
          <Link
            href="/app/contexts"
            className="inline-block mt-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 text-sm font-medium"
          >
            {t('setupRequired.createButton')}
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {t('readyToInvite.title')}
            </span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            {t('readyToInvite.activeStyle', { name: teamData.activeContext.name })}
          </p>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('teamMembers.title')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('teamMembers.subtitle')}
          </p>
        </div>

        {teamMembers.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('teamMembers.noMembers.title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('teamMembers.noMembers.subtitle')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {/* Header row for stats */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="w-[200px] text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t('teamMembers.headers.member')}
                </div>
                <div className="flex items-center gap-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <div className="flex justify-center min-w-[60px]">{t('teamMembers.headers.selfies')}</div>
                  <div className="flex justify-center min-w-[60px]">{t('teamMembers.headers.generations')}</div>
                  <div className="flex justify-center min-w-[80px]">{t('teamMembers.headers.personalCredits')}</div>
                  <div className="flex justify-center min-w-[80px]">{t('teamMembers.headers.teamCredits')}</div>
                  <div className="flex justify-center min-w-[100px]">{t('teamMembers.headers.status')}</div>
                  {userRoles.isTeamAdmin && (
                    <div className="flex justify-center min-w-[120px]">{t('teamMembers.headers.actions')}</div>
                  )}
                </div>
              </div>
            </div>
            
            {teamMembers.map((member) => (
              <div key={member.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  {/* Member Info */}
                  <div className="flex items-center gap-3 w-[200px]">
                    <div className="w-10 h-10 bg-brand-primary-light rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-brand-primary">
                        {member.isCurrentUser 
                          ? t('teamMembers.you') 
                          : member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        }
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member.isCurrentUser ? 'You' : member.name}
                        </p>
                        {member.isAdmin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            {t('teamMembers.roles.teamAdmin')}
                          </span>
                        )}
                        {!member.isAdmin && member.userId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                            {t('teamMembers.roles.teamMember')}
                          </span>
                        )}
                        {!member.userId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 flex-shrink-0">
                            {t('teamMembers.roles.guest')}
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Stats and Status */}
                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    {member.stats && (
                      <>
                        <div className="flex justify-center min-w-[60px]">
                          <span className="font-semibold text-gray-900">{member.stats.selfies}</span>
                        </div>
                        <div className="flex justify-center min-w-[60px]">
                          <span className="font-semibold text-gray-900">{member.stats.generations}</span>
                        </div>
                        <div className="flex justify-center min-w-[80px]">
                          <span className="font-semibold text-gray-900">{member.stats.individualCredits}</span>
                        </div>
                        <div className="flex justify-center min-w-[80px]">
                          <span className="font-semibold text-gray-900">{member.stats.teamCredits}</span>
                        </div>
                      </>
                    )}
                    
                    {/* Status */}
                    <div className="text-center min-w-[100px]">
                      {member.userId ? (
                        <div className="flex items-center justify-center gap-1.5 text-green-600">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamMembers.status.registered')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-blue-600">
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamMembers.status.guest')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Admin Actions */}
                    {userRoles.isTeamAdmin && !member.isCurrentUser && member.userId && (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        {!member.isAdmin && (
                          <button
                            onClick={() => handleChangeMemberRole(member.id, 'team_admin')}
                            disabled={changingRole === member.id}
                            className="text-xs px-2 py-1 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                          >
                            {changingRole === member.id ? t('teamMembers.actions.promoting') : t('teamMembers.actions.makeAdmin')}
                          </button>
                        )}
                        {member.isAdmin && (
                          <button
                            onClick={() => handleChangeMemberRole(member.id, 'team_member')}
                            disabled={changingRole === member.id}
                            className="text-xs px-2 py-1 text-orange-600 hover:text-orange-800 disabled:opacity-50"
                          >
                            {changingRole === member.id ? t('teamMembers.actions.demoting') : t('teamMembers.actions.demote')}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removing === member.id}
                          className="text-xs px-2 py-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {removing === member.id ? t('teamMembers.actions.removing') : t('teamMembers.actions.remove')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Invites */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('teamInvites.title')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('teamInvites.subtitle')}
          </p>
        </div>

        {invites.length === 0 ? (
          <div className="p-6 text-center">
            {credits.team === 0 ? (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('teamInvites.noCredits.title')}</h3>
                <p className="text-gray-600 mb-4">
                  {t('teamInvites.noCredits.subtitle')}
                </p>
                <Link
                  href={isFreePlan ? '/app/upgrade' : '/app/top-up'}
                  className="inline-block px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover transition-colors text-center"
                >
                  {t('teamInvites.noCredits.button')}
                </Link>
              </>
            ) : (
              <>
                <EnvelopeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('teamInvites.noInvites.title')}</h3>
                <p className="text-gray-600 mb-4">
                  {t('teamInvites.noInvites.subtitle')}
                </p>
                {userRoles.isTeamAdmin && (
                  <button
                    onClick={() => setShowInviteForm(true)}
                    disabled={(!teamData?.activeContext && !isFreePlan) || credits.team === 0}
                    className={`px-4 py-2 rounded-md ${
                      (teamData?.activeContext || isFreePlan) && credits.team > 0
                        ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {t('teamInvites.noInvites.button')}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {invites.map((invite) => (
              <div key={invite.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        {t('teamInvites.creditsAllocated', { count: invite.creditsAllocated })}
                        {invite.creditsUsed !== undefined && invite.creditsUsed > 0 && (
                          <span className="ml-2 text-orange-600">
                            • {t('teamInvites.creditsUsed', { count: invite.creditsUsed })}
                          </span>
                        )}
                      </p>
                      {invite.contextName && (
                        <p className="text-xs text-gray-400 mt-1">
                          Photo style: {invite.contextName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {invite.usedAt ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.accepted')}</span>
                        </div>
                      ) : isExpired(invite.expiresAt) ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <XMarkIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.expired')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.pending')}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        {invite.usedAt 
                          ? t('teamInvites.dates.used', { date: formatInviteDate(invite.usedAt) })
                          : t('teamInvites.dates.expires', { date: formatInviteDate(invite.expiresAt) })
                        }
                      </p>
                    </div>
                    
                    {/* Action buttons for admins */}
                    {userRoles.isTeamAdmin && !invite.usedAt && (
                      <div className="flex items-center gap-2">
                        {!isExpired(invite.expiresAt) && (
                          <button
                            onClick={() => handleResendInvite(invite.id)}
                            disabled={resending === invite.id}
                            className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {resending === invite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                          </button>
                        )}
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revoking === invite.id}
                          className="text-xs px-2 py-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {revoking === invite.id ? t('teamInvites.actions.revoking') : t('teamInvites.actions.revoke')}
                        </button>
                      </div>
                    )}
                    
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-mono">
                        {invite.token.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t('inviteForm.title')}
              </h2>

              <form action={handleInviteTeamMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inviteForm.email.label')} *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    placeholder={t('inviteForm.email.placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inviteForm.firstName.label')} *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    placeholder={t('inviteForm.firstName.placeholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Personalizes the invite email
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inviteForm.credits.label')}
                  </label>
                  <input
                    type="number"
                    name="creditsAllocated"
                    min="1"
                    max="50"
                    value={creditsInputValue}
                    onChange={(e) => {
                      const value = e.target.value
                      setCreditsInputValue(value)
                      
                      if (value === '') {
                        setAllocatedCredits(0)
                      } else {
                        const numValue = parseInt(value)
                        if (!isNaN(numValue) && numValue >= 0) {
                          setAllocatedCredits(numValue)
                        }
                      }
                    }}
                    onFocus={(e) => {
                      e.target.select()
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('inviteForm.credits.hint', { 
                      credits: PRICING_CONFIG.credits.perGeneration,
                      default: `Each photo generation uses ${PRICING_CONFIG.credits.perGeneration} credits`
                    })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('inviteForm.photoStyle.label', { default: 'Photo Style' })}
                  </label>
                  {isFreePlan ? (
                    // Free plan: Show static message about free package style (no choice)
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {t('inviteForm.photoStyle.useFreePackageStyle', { 
                          default: 'Free Package Style',
                          name: 'Free Package Style'
                        })}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t('inviteForm.photoStyle.useFreePackageStyleDesc', { 
                          default: 'Team member will use the free package photo style. This cannot be changed for free plan accounts.'
                        })}
                      </div>
                      {/* Hidden input to ensure form submission works */}
                      <input type="hidden" name="photoStyleType" value="context" />
                    </div>
                  ) : (
                    // Paid plan: Show radio button choices
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="photoStyleType"
                          value="context"
                          defaultChecked
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {t('inviteForm.photoStyle.useActiveStyle', { default: 'Use Active Photo Style' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {t('inviteForm.photoStyle.useActiveStyleDesc', { 
                              default: 'Team member will use the predefined photo style',
                              name: teamData?.activeContext?.name || 'Active Style'
                            })}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="photoStyleType"
                          value="freestyle"
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {t('inviteForm.photoStyle.allowFreestyle', { default: 'Allow Freestyle' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {t('inviteForm.photoStyle.allowFreestyleDesc', { 
                              default: 'Team member can customize their own photo style'
                            })}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">{t('inviteForm.whatHappensNext.title')}</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• {t('inviteForm.whatHappensNext.step1')}</li>
                    <li>• {t('inviteForm.whatHappensNext.step2')}</li>
                    <li>• {t('inviteForm.whatHappensNext.step3')}</li>
                    <li>• {t('inviteForm.whatHappensNext.step4', { 
                      name: isFreePlan 
                        ? 'Free Package Style' 
                        : (teamData?.activeContext?.name || 'Active Style')
                    })}</li>
                  </ul>
                </div>

                {allocatedCredits > credits.team && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 text-sm">
                      {t('inviteForm.insufficientCreditsModal', { 
                        required: allocatedCredits, 
                        available: credits.team 
                      })}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={inviting || allocatedCredits > credits.team}
                    className={`flex-1 px-4 py-2 rounded-md ${
                      allocatedCredits > credits.team
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-brand-primary text-white hover:bg-brand-primary-hover disabled:opacity-50'
                    }`}
                  >
                    {inviting ? t('inviteForm.buttons.sending') : t('inviteForm.buttons.send')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    {t('inviteForm.buttons.cancel')}
                  </button>
                </div>
                {inviteError && <p className="text-red-500 text-sm mt-2">{inviteError}</p>}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}