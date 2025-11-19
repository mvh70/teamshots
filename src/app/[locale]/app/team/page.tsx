'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import { Link } from '@/i18n/routing'
import { PlusIcon, EnvelopeIcon, ClockIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { getBrandColor } from '@/config/brand'
import { useCredits } from '@/contexts/CreditsContext'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { ErrorCard, Grid } from '@/components/ui'
import { Sparkles, Users, Camera, Image, XCircle } from 'lucide-react'

interface TeamInvite {
  id: string
  email: string
  firstName?: string
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
  const { isFreePlan } = usePlanInfo()
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
  // Convert between photos and credits (1 photo = 10 credits)
  const defaultPhotos = PRICING_CONFIG.team.defaultInviteCredits / PRICING_CONFIG.credits.perGeneration
  const [allocatedPhotos, setAllocatedPhotos] = useState<number>(defaultPhotos)
  const [photosInputValue, setPhotosInputValue] = useState(defaultPhotos.toString())
  const [emailValue, setEmailValue] = useState('')
  const [firstNameValue, setFirstNameValue] = useState('')
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [submittingTeam, setSubmittingTeam] = useState(false)
  const [teamNameValue, setTeamNameValue] = useState('')
  const [teamWebsiteValue, setTeamWebsiteValue] = useState('')
  const hasCheckedWelcomePopup = useRef(false)

  useEffect(() => {
    const fetchInitialData = async () => {
      if (session?.user) {
        // OPTIMIZATION: Check sessionStorage for initial data first
        try {
          const stored = sessionStorage.getItem('teamshots.initialData')
          if (stored) {
            const initialData = JSON.parse(stored)
            if (initialData.roles && initialData.onboarding) {
              const { isTeamAdmin, isTeamMember, isPlatformAdmin } = initialData.roles
              const { needsTeamSetup } = initialData.onboarding
              const teamId = initialData.roles.teamId
              const teamName = initialData.roles.teamName

              setUserRoles({ isTeamAdmin, isTeamMember, isPlatformAdmin })

              if (isTeamAdmin) {
                if (needsTeamSetup) {
                  setNeedsTeamSetup(true)
                  setLoading(false)

                  // Check if user just signed up - show welcome popup if data is fresh (within 30 seconds)
                  // This will be checked in a separate useEffect to avoid hydration mismatch
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
              return
            }
          }
        } catch {
          // Ignore parse errors, fall through to fetch
        }

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

  // Check for welcome popup after hydration to avoid hydration mismatch
  useEffect(() => {
    if (needsTeamSetup && !hasCheckedWelcomePopup.current) {
      hasCheckedWelcomePopup.current = true
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData._timestamp) {
            const timestamp = initialData._timestamp
            const thirtySecondsAgo = Date.now() - 30 * 1000
            if (timestamp > thirtySecondsAgo) {
              setShowWelcomePopup(true)
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }, [needsTeamSetup])

  // Check if we should auto-open invite modal from onboarding
  useEffect(() => {
    const shouldOpenModal = sessionStorage.getItem('open-invite-modal')
    if (shouldOpenModal === 'true' && !loading && teamData && userRoles.isTeamAdmin) {
      // Clear the flag
      sessionStorage.removeItem('open-invite-modal')
      // Open the invite modal automatically
      setShowInviteForm(true)
      // Reset form values
      setEmailValue('')
      setFirstNameValue('')
      setPhotosInputValue(defaultPhotos.toString())
      setAllocatedPhotos(defaultPhotos)
      setInviteError(null)
      setError(null)
    }
  }, [loading, teamData, userRoles.isTeamAdmin, defaultPhotos])

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


  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmittingTeam(true)
    setError(null)
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamNameValue,
          website: teamWebsiteValue
        })
      })

      if (response.ok) {
        const data = await response.json()
        const teamName = teamNameValue

        // Update sessionStorage with new team data to avoid redundant API calls
        try {
          const stored = sessionStorage.getItem('teamshots.initialData')
          let initialData = null
          if (stored) {
            initialData = JSON.parse(stored)
            if (initialData.roles) {
              initialData.roles.teamId = data.teamId
              initialData.roles.teamName = teamName
              initialData.roles.isTeamMember = true
              initialData.onboarding.needsTeamSetup = false
              initialData._timestamp = Date.now()
              sessionStorage.setItem('teamshots.initialData', JSON.stringify(initialData))
            }
          }

          // Onboarding context will be fetched fresh from database on next page load

          // Set transition flag so dashboard knows to show onboarding immediately
          sessionStorage.setItem('show-onboarding-immediately', 'true')

        } catch {
          // Ignore errors, continue with redirect
        }

        // Clear any old pending tours from database before redirecting to dashboard
        // This prevents automatic redirects to styles/team page
        try {
          const deactivatedTours = [
            'team-admin-welcome',
            'team-setup',
            'team-photo-styles-page',
            'team-photo-styles-free',
            'team-photo-style-setup'
          ]

          // Clear each deactivated tour from database
          await Promise.all(
            deactivatedTours.map(tourName =>
              fetch(`/api/onboarding/pending-tour?tourName=${encodeURIComponent(tourName)}`, {
                method: 'DELETE',
              }).catch(() => {
                // Ignore individual errors, continue clearing others
              })
            )
          )
        } catch {
          // Ignore errors, continue with redirect
        }

        // Also clear sessionStorage tours (legacy)
        try {
          const pendingTour = sessionStorage.getItem('pending-tour')
          const deactivatedTours = [
            'team-admin-welcome',
            'team-setup',
            'team-photo-styles-page',
            'team-photo-styles-free',
            'team-photo-style-setup'
          ]
          if (pendingTour && deactivatedTours.includes(pendingTour)) {
            sessionStorage.removeItem('pending-tour')
          }
        } catch {
          // Ignore errors, continue with redirect
        }

        // Set flag to prevent any automatic redirects to photo styles page
        // Users should complete onboarding first, then navigate when ready
        try {
          sessionStorage.setItem('prevent-style-redirect', 'true')
        } catch {
          // Ignore errors
        }

        // Redirect immediately to dashboard using hard navigation to avoid showing intermediate state
        console.log('Team page: Team created successfully, redirecting to dashboard immediately')
        window.location.href = '/app/dashboard'
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create team.')
        setSubmittingTeam(false)
      }
    } catch {
      setError('An error occurred while creating the team.')
      setSubmittingTeam(false)
    }
  }

  const handleInviteTeamMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setInviteError(null)
    setSuccessMessage(null)
    setInviting(true)

    // Get values from controlled state, not FormData
    const email = emailValue.trim()
    const firstName = firstNameValue.trim()

    // Validate required fields
    if (!email || !firstName) {
      setInviteError('Email and first name are required')
      setInviting(false)
      return
    }

    if (credits.team < allocatedPhotos * PRICING_CONFIG.credits.perGeneration) {
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
          creditsAllocated: allocatedPhotos * PRICING_CONFIG.credits.perGeneration
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setShowInviteForm(false)
        setError(null)
        setInviteError(null)
        // Clear form values on success
        setEmailValue('')
        setFirstNameValue('')
        setPhotosInputValue(defaultPhotos.toString())
        setAllocatedPhotos(defaultPhotos)
        setSuccessMessage(t('inviteForm.success', { email }))
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        // Show form-specific errors in the modal, not as page-level errors
        if (data.errorCode === 'INVALID_CREDIT_ALLOCATION' || data.errorCode === 'INSUFFICIENT_TEAM_CREDITS') {
          setInviteError(data.error)
        } else if (data.errorCode === 'NO_ACTIVE_CONTEXT') {
          setError(`${data.error} Click here to set up a context.`)
        } else {
          setInviteError(data.error)
        }
      }
    } catch {
      setInviteError('Failed to send invite')
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
        await fetchTeamData()
        setError(null)
        setSuccessMessage(t('teamInvites.actions.resendSuccess'))
        setTimeout(() => setSuccessMessage(null), 5000)
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

  // Removed unused formatInviteDate to satisfy linter

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  // Filter out accepted invites (they should only appear as team members)
  const pendingInvites = useMemo(() => invites.filter(invite => !invite.usedAt), [invites])
  
  // Sort team members: admins first, then non-admins
  const sortedTeamMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      // Admins first
      if (a.isAdmin && !b.isAdmin) return -1
      if (!a.isAdmin && b.isAdmin) return 1
      // Otherwise maintain original order
      return 0
    })
  }, [teamMembers])
  
  // Create a map of invites by email for easy lookup
  const invitesByEmail = useMemo(() => {
    const map = new Map<string, TeamInvite>()
    invites.forEach(invite => {
      map.set(invite.email.toLowerCase(), invite)
    })
    return map
  }, [invites])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (needsTeamSetup) {
    return (
      <>
        {/* Welcome Popup Modal */}
        {showWelcomePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-primary/10 mb-4">
                  <Sparkles className="h-6 w-6 text-brand-primary" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t('setup.welcomePopup.title')}
                </h3>
                <p className="text-gray-600 mb-6">
                  {t('setup.welcomePopup.message')}
                </p>
                <button
                  onClick={() => setShowWelcomePopup(false)}
                  className="w-full px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                >
                  {t('setup.welcomePopup.dismiss')}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="max-w-xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
          <div id="welcome-section">
            <h2 className="text-2xl font-bold text-gray-900">{t('setup.title')}</h2>
            <p className="mt-2 text-gray-600">{t('setup.subtitle')}</p>
          </div>
          <form onSubmit={handleCreateTeam} className="mt-6 space-y-4 text-left">
          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700">
              {t('setup.teamNameLabel')}
            </label>
            <input
              type="text"
              name="teamName"
              id="teamName"
              required
              value={teamNameValue}
              onChange={(e) => setTeamNameValue(e.target.value)}
              disabled={submittingTeam}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              value={teamWebsiteValue}
              onChange={(e) => setTeamWebsiteValue(e.target.value)}
              disabled={submittingTeam}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder={t('setup.teamWebsitePlaceholder')}
            />
          </div>
          <button
            type="submit"
            disabled={submittingTeam}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingTeam ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              t('setup.createButton')
            )}
          </button>
        </form>
      </div>
      </>
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
    return <ErrorCard message={error} />
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-brand-secondary-light border border-brand-secondary-lighter rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="flex-shrink-0 w-8 h-8 bg-brand-secondary-lighter rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-brand-secondary" />
          </div>
          <p className="text-brand-secondary-text-light font-medium">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div id="welcome-section" className="flex flex-col gap-6">
        <div className="space-y-2">
          <h1 id="team-name-header" className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {teamData?.name || t('title')}
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        
        {userRoles.isTeamAdmin && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              id="invite-team-member-btn"
              onClick={() => {
                setInviteError(null)
                setError(null)
                setEmailValue('')
                setFirstNameValue('')
                setPhotosInputValue(defaultPhotos.toString())
                setAllocatedPhotos(defaultPhotos)
                setShowInviteForm(true)
              }}
              disabled={(!teamData?.activeContext && !isFreePlan) || credits.team === 0}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                (teamData?.activeContext || isFreePlan) && credits.team > 0
                  ? 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PlusIcon className="h-5 w-5" />
              {t('buttons.inviteTeamMember')}
            </button>
          </div>
        )}
      </div>

      {/* Team Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 bg-brand-primary-light rounded-xl flex items-center justify-center ring-2 ring-brand-primary-light">
              <Users className="h-7 w-7" style={{ color: getBrandColor('primary') }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 mb-1">Team members</p>
              <p className="text-3xl font-bold text-gray-900">
                {(teamMembers?.length || 0) + (invites?.filter(inv => !inv.usedAt).length || 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 bg-brand-primary-light rounded-xl flex items-center justify-center ring-2 ring-brand-primary-light">
              <Camera className="h-7 w-7" style={{ color: getBrandColor('primary') }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 mb-1">Available photos</p>
              <p className="text-3xl font-bold text-gray-900">{calculatePhotosFromCredits(credits.team)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 bg-brand-secondary-light rounded-xl flex items-center justify-center ring-2 ring-brand-secondary-light">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image className="h-7 w-7" style={{ color: getBrandColor('secondary') }} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 mb-1">Photos generated</p>
              <p className="text-3xl font-bold text-gray-900">
                {teamMembers?.reduce((acc, member) => acc + (member.stats?.generations || 0), 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Status */}
      {isFreePlan && !teamData?.activeContext ? (
        <div id="team-free-plan-banner" className="space-y-4">
          <FreePlanBanner variant="team" />
        </div>
      ) : !teamData?.activeContext ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-0.5">
              <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-yellow-800 font-semibold text-base block mb-1">
                {t('setupRequired.title')}
              </span>
              <p className="text-yellow-700 text-sm mb-3">
                {t('setupRequired.message')}
              </p>
              <Link
                href="/app/contexts"
                className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                {t('setupRequired.createButton')}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div id="team-active-style" className="bg-brand-secondary-light border border-brand-secondary-lighter rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-secondary-lighter rounded-full flex items-center justify-center mt-0.5">
              <CheckIcon className="h-5 w-5 text-brand-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-brand-secondary-text-light font-semibold text-base block mb-1">
                {t('readyToInvite.title')}
              </span>
              <p className="text-brand-secondary-text text-sm">
                {t('readyToInvite.activeStyle', { 
                  name: (isFreePlan && (!teamData.activeContext.name || teamData.activeContext.name === 'unnamed')) 
                    ? 'Free Package Style' 
                    : teamData.activeContext.name 
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Members & Invites */}
      <div id="team-invites-table" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {teamMembers.length === 0 && pendingInvites.length === 0 ? (
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
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('teamMembers.noMembers.title')}</h3>
                <p className="text-gray-600 mb-4">
                  {t('teamMembers.noMembers.subtitle')}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: Table Layout */}
            <div className="hidden md:block divide-y divide-gray-200">
                {/* Header row */}
                <div className="px-6 py-4 bg-white border-b border-gray-200">
                  <div 
                    className={`grid gap-6 text-sm font-bold text-gray-900 ${
                      userRoles.isTeamAdmin 
                        ? 'grid-cols-[250px_repeat(4,minmax(80px,1fr))_140px]' 
                        : 'grid-cols-[250px_repeat(4,minmax(80px,1fr))]'
                    }`}
                  >
                    <div>{t('teamMembers.headers.member')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.selfies')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.generations')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.availablePhotos')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.status')}</div>
                    {userRoles.isTeamAdmin && (
                      <div className="flex justify-center">{t('teamMembers.headers.actions')}</div>
                    )}
                  </div>
                </div>
                
                {/* Team Members - Admins first, then non-admins */}
                {sortedTeamMembers.map((member) => {
                  // Find corresponding invite for this member
                  const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                  const creditsAllocated = memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                  // For team admins, don't show individual credits used (they use company credits)
                  // For regular members, use invite credits used or 0
                  const creditsUsed = member.isAdmin ? 0 : (memberInvite?.creditsUsed ?? 0)
                  const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                  
                  return (
                <div key={`member-${member.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div 
                    className={`grid gap-6 items-center ${
                      userRoles.isTeamAdmin 
                        ? 'grid-cols-[250px_repeat(4,minmax(80px,1fr))_140px]' 
                        : 'grid-cols-[250px_repeat(4,minmax(80px,1fr))]'
                    }`}
                  >
                    {/* Member Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-brand-primary-light rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-brand-primary">
                          {member.isCurrentUser 
                            ? t('teamMembers.you') 
                            : member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                          }
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.isCurrentUser ? 'You' : member.name}
                          </p>
                          {member.isAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-premium/10 text-brand-premium flex-shrink-0">
                              {t('teamMembers.roles.teamAdmin')}
                            </span>
                          )}
                          {!member.isAdmin && member.userId && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-primary-light text-brand-primary flex-shrink-0">
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
                        {!member.isAdmin && (
                          <p className="text-xs text-gray-400 mt-1">
                            {t('teamInvites.photosAllocated', { count: calculatePhotosFromCredits(creditsAllocated) })}
                            {creditsUsed > 0 && (
                              <span className="ml-2 text-brand-cta">
                                • {t('teamInvites.photosUsed', { count: calculatePhotosFromCredits(creditsUsed) })}
                              </span>
                            )}
                          </p>
                        )}
                        {/* Team admins don't show photo style or photos used - they use company photos */}
                        {photoStyle && !member.isAdmin && (
                          <p className="text-xs text-gray-400 mt-1">
                            Photo style:{' '}
                            <Link 
                              href="/app/styles/team"
                              className="text-brand-primary hover:text-brand-primary-hover underline"
                            >
                              {photoStyle}
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Selfies */}
                    <div className="flex justify-center">
                      {member.stats ? (
                        <span className="text-sm font-semibold text-gray-900">{member.stats.selfies}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                    
                    {/* Generations */}
                    <div className="flex justify-center">
                      {member.stats ? (
                        <span className="text-sm font-semibold text-gray-900">{member.stats.generations}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                    
                    {/* Available Photos */}
                    <div className="flex justify-center">
                      {member.stats ? (
                        <span className="text-sm font-semibold text-gray-900">
                          {member.isAdmin ? calculatePhotosFromCredits(credits.team) : calculatePhotosFromCredits(member.stats.teamCredits ?? 0)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                    
                    {/* Status */}
                    <div className="flex justify-center">
                      {member.userId ? (
                        <div className="flex items-center justify-center gap-1.5 text-brand-secondary">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamMembers.status.registered')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-brand-secondary">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamMembers.status.guest')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Admin Actions */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex items-center justify-center gap-2">
                        {memberInvite && (
                          <button
                            onClick={() => handleResendInvite(memberInvite.id)}
                            disabled={resending === memberInvite.id}
                            className="text-xs px-3 py-1.5 rounded-md text-brand-primary border border-brand-primary hover:bg-brand-primary/10 disabled:opacity-50"
                          >
                            {resending === memberInvite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                          </button>
                        )}
                        {!member.isCurrentUser && member.userId && (
                          <>
                            {!member.isAdmin && (
                              <button
                                onClick={() => handleChangeMemberRole(member.id, 'team_admin')}
                                disabled={changingRole === member.id}
                                className="text-xs px-3 py-1.5 rounded-md text-brand-premium border border-brand-premium hover:bg-brand-premium/10 disabled:opacity-50"
                              >
                                {changingRole === member.id ? t('teamMembers.actions.promoting') : t('teamMembers.actions.makeAdmin')}
                              </button>
                            )}
                            {member.isAdmin && (
                              <button
                                onClick={() => handleChangeMemberRole(member.id, 'team_member')}
                                disabled={changingRole === member.id}
                                className="text-xs px-3 py-1.5 rounded-md text-brand-cta border border-brand-cta hover:bg-brand-cta/10 disabled:opacity-50"
                              >
                                {changingRole === member.id ? t('teamMembers.actions.demoting') : t('teamMembers.actions.demote')}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={removing === member.id}
                              className="text-xs px-3 py-1.5 rounded-md text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {removing === member.id ? t('teamMembers.actions.removing') : t('teamMembers.actions.remove')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                  )
                })}

                {/* Team Invites - only show pending invites */}
                {pendingInvites.map((invite) => (
                <div key={`invite-${invite.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div 
                    className={`grid gap-6 items-center ${
                      userRoles.isTeamAdmin 
                        ? 'grid-cols-[250px_repeat(4,minmax(80px,1fr))_140px]' 
                        : 'grid-cols-[250px_repeat(4,minmax(80px,1fr))]'
                    }`}
                  >
                    {/* Invite Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {invite.firstName || invite.email}
                        </p>
                        {invite.firstName && invite.email && (
                          <p className="text-xs text-gray-500 truncate">{invite.email}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {t('teamInvites.creditsAllocated', { count: calculatePhotosFromCredits(invite.creditsAllocated) })}
                          {invite.usedAt && invite.creditsUsed !== undefined && invite.creditsUsed > 0 && (
                            <span className="ml-2 text-brand-cta">
                              • {t('teamInvites.creditsUsed', { count: calculatePhotosFromCredits(invite.creditsUsed) })}
                            </span>
                          )}
                        </p>
                        {invite.contextName && (
                          <p className="text-xs text-gray-400 mt-1">
                            Photo style:{' '}
                            <Link 
                              href="/app/styles/team"
                              className="text-brand-primary hover:text-brand-primary-hover underline"
                            >
                              {invite.contextName}
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Selfies - empty for pending invites */}
                    <div className="flex justify-center">
                      {/* Empty - invite not accepted yet */}
                    </div>
                    
                    {/* Generations - empty for pending invites */}
                    <div className="flex justify-center">
                      {/* Empty - invite not accepted yet */}
                    </div>
                    
                    {/* Available Credits */}
                    <div className="flex justify-center">
                      <span className="text-sm font-semibold text-gray-900">{calculatePhotosFromCredits(invite.creditsAllocated)}</span>
                    </div>
                    
                    {/* Status */}
                    <div className="flex justify-center">
                      {invite.usedAt ? (
                        <div className="flex items-center justify-center gap-1.5 text-brand-secondary">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.accepted')}</span>
                        </div>
                      ) : isExpired(invite.expiresAt) ? (
                        <div className="flex items-center justify-center gap-1.5 text-red-600">
                          <XMarkIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.expired')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-yellow-600">
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('teamInvites.status.pending')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Admin Actions */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleResendInvite(invite.id)}
                          disabled={resending === invite.id}
                          className="text-xs px-3 py-1.5 rounded-md text-brand-primary border border-brand-primary hover:bg-brand-primary/10 disabled:opacity-50"
                        >
                          {resending === invite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                        </button>
                        {!invite.usedAt && (
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
                            disabled={revoking === invite.id}
                            className="text-xs px-3 py-1.5 rounded-md text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {revoking === invite.id ? t('teamInvites.actions.revoking') : t('teamInvites.actions.revoke')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

              {/* Mobile: Card Layout */}
              <div className="md:hidden divide-y divide-gray-200">
                {/* Team Members - Admins first, then non-admins */}
                {sortedTeamMembers.map((member) => {
                  // Find corresponding invite for this member
                  const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                  const creditsAllocated = memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                  // For team admins, don't show individual credits used (they use company credits)
                  // For regular members, use invite credits used or 0
                  const creditsUsed = member.isAdmin ? 0 : (memberInvite?.creditsUsed ?? 0)
                  const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                  
                  return (
                <div key={`member-${member.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand-primary-light rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-brand-primary">
                        {member.isCurrentUser 
                          ? t('teamMembers.you') 
                          : member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        }
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.isCurrentUser ? 'You' : member.name}
                        </p>
                        {member.isAdmin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-premium/10 text-brand-premium">
                            {t('teamMembers.roles.teamAdmin')}
                          </span>
                        )}
                        {!member.isAdmin && member.userId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-primary-light text-brand-primary">
                            {t('teamMembers.roles.teamMember')}
                          </span>
                        )}
                        {!member.userId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {t('teamMembers.roles.guest')}
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <p className="text-xs text-gray-500">{member.email}</p>
                      )}
                      {!member.isAdmin && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('teamInvites.creditsAllocated', { count: calculatePhotosFromCredits(creditsAllocated) })}
                          {creditsUsed > 0 && (
                            <span className="ml-2 text-brand-cta">
                              • {t('teamInvites.creditsUsed', { count: calculatePhotosFromCredits(creditsUsed) })}
                            </span>
                          )}
                        </p>
                      )}
                      {/* Team admins don't show credits used - they use company credits */}
                      {photoStyle && (
                        <p className="text-xs text-gray-400 mt-1">
                          Photo style:{' '}
                          <Link 
                            href="/app/styles/team"
                            className="text-brand-primary hover:text-brand-primary-hover underline"
                          >
                            {photoStyle}
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  {member.stats && (
                    <Grid cols={{ mobile: 2 }} gap="sm" className="mb-4 pl-[52px]">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('teamMembers.headers.selfies')}</p>
                        <p className="text-sm font-semibold text-gray-900">{member.stats.selfies}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('teamMembers.headers.generations')}</p>
                        <p className="text-sm font-semibold text-gray-900">{member.stats.generations}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('teamMembers.headers.availablePhotos')}</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {member.isAdmin ? calculatePhotosFromCredits(credits.team) : calculatePhotosFromCredits(member.stats.teamCredits ?? 0)}
                        </p>
                      </div>
                    </Grid>
                  )}

                  {/* Status */}
                  <div className="mb-4 pl-[52px]">
                    {member.userId ? (
                      <div className="flex items-center gap-1.5 text-brand-secondary">
                        <CheckIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('teamMembers.status.registered')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-brand-secondary">
                        <CheckIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('teamMembers.status.guest')}</span>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {userRoles.isTeamAdmin && (
                    <div className="flex flex-wrap gap-2 pl-[52px]">
                      {memberInvite && (
                        <button
                          onClick={() => handleResendInvite(memberInvite.id)}
                          disabled={resending === memberInvite.id}
                          className="text-xs px-3 py-1.5 rounded-md text-brand-primary border border-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 min-h-[44px]"
                        >
                          {resending === memberInvite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                        </button>
                      )}
                      {!member.isCurrentUser && member.userId && (
                        <>
                          {!member.isAdmin && (
                            <button
                              onClick={() => handleChangeMemberRole(member.id, 'team_admin')}
                              disabled={changingRole === member.id}
                              className="text-xs px-3 py-1.5 rounded-md text-brand-premium border border-brand-premium hover:bg-brand-premium/10 disabled:opacity-50 min-h-[44px]"
                            >
                              {changingRole === member.id ? t('teamMembers.actions.promoting') : t('teamMembers.actions.makeAdmin')}
                            </button>
                          )}
                          {member.isAdmin && (
                            <button
                              onClick={() => handleChangeMemberRole(member.id, 'team_member')}
                              disabled={changingRole === member.id}
                              className="text-xs px-3 py-1.5 rounded-md text-brand-cta border border-brand-cta hover:bg-brand-cta/10 disabled:opacity-50 min-h-[44px]"
                            >
                              {changingRole === member.id ? t('teamMembers.actions.demoting') : t('teamMembers.actions.demote')}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removing === member.id}
                            className="text-xs px-3 py-1.5 rounded-md text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50 min-h-[44px]"
                          >
                            {removing === member.id ? t('teamMembers.actions.removing') : t('teamMembers.actions.remove')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                  )
                })}

                {/* Team Invites - only show pending invites */}
                {pendingInvites.map((invite) => (
                <div key={`invite-${invite.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {invite.firstName || invite.email}
                      </p>
                      {invite.firstName && invite.email && (
                        <p className="text-xs text-gray-500">{invite.email}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {t('teamInvites.creditsAllocated', { count: calculatePhotosFromCredits(invite.creditsAllocated) })}
                        {invite.usedAt && invite.creditsUsed !== undefined && invite.creditsUsed > 0 && (
                          <span className="ml-2 text-brand-cta">
                            • {t('teamInvites.creditsUsed', { count: calculatePhotosFromCredits(invite.creditsUsed) })}
                          </span>
                        )}
                      </p>
                      {invite.contextName && (
                        <p className="text-xs text-gray-400 mt-1">
                          Photo style:{' '}
                          {invite.contextId ? (
                            <Link 
                              href={`/app/styles/team/${invite.contextId}/edit`}
                              className="text-brand-primary hover:text-brand-primary-hover underline"
                            >
                              {invite.contextName}
                            </Link>
                          ) : (
                            <Link 
                              href="/app/styles/team"
                              className="text-brand-primary hover:text-brand-primary-hover underline"
                            >
                              {invite.contextName}
                            </Link>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mb-4 pl-[52px]">
                    {invite.usedAt ? (
                      <div className="flex items-center gap-1.5 text-brand-secondary">
                        <CheckIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('teamInvites.status.accepted')}</span>
                      </div>
                    ) : isExpired(invite.expiresAt) ? (
                      <div className="flex items-center gap-1.5 text-red-600">
                        <XMarkIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('teamInvites.status.expired')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-yellow-600">
                        <ClockIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('teamInvites.status.pending')}</span>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {userRoles.isTeamAdmin && (
                    <div className="flex flex-wrap gap-2 pl-[52px]">
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={resending === invite.id}
                        className="text-xs px-3 py-1.5 rounded-md text-brand-primary border border-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 min-h-[44px]"
                      >
                        {resending === invite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                      </button>
                      {!invite.usedAt && (
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revoking === invite.id}
                          className="text-xs px-3 py-1.5 rounded-md text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50 min-h-[44px]"
                        >
                          {revoking === invite.id ? t('teamInvites.actions.revoking') : t('teamInvites.actions.revoke')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                ))}
              </div>
            </>
          )}
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t('inviteForm.title')}
              </h2>

              <form onSubmit={handleInviteTeamMember} className="space-y-5" noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inviteForm.email.label')} *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
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
                    value={firstNameValue}
                    onChange={(e) => setFirstNameValue(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                    placeholder={t('inviteForm.firstName.placeholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Personalizes the invite email
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inviteForm.photos.label')}
                  </label>
                  <input
                    type="number"
                    name="photosAllocated"
                    min="1"
                    max={Math.floor(credits.team / PRICING_CONFIG.credits.perGeneration)}
                    value={photosInputValue}
                    onChange={(e) => {
                      const value = e.target.value
                      setPhotosInputValue(value)
                      // Clear error when user starts typing
                      if (inviteError) {
                        setInviteError(null)
                      }
                      
                      if (value === '') {
                        setAllocatedPhotos(0)
                      } else {
                        const numValue = parseInt(value)
                        if (!isNaN(numValue) && numValue >= 0) {
                          setAllocatedPhotos(numValue)
                        }
                      }
                    }}
                    onFocus={(e) => {
                      e.target.select()
                    }}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors ${
                      inviteError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-brand-primary'
                    }`}
                  />
                  {inviteError ? (
                    <p className="text-red-600 text-sm mt-1 font-medium">{inviteError}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('inviteForm.photos.hint', {
                        count: PRICING_CONFIG.regenerations.invited,
                        default: `Each photo can be retried up to ${PRICING_CONFIG.regenerations.invited} times for free`
                      })}
                    </p>
                  )}
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

                <div className="bg-brand-primary-light border border-brand-primary/20 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-brand-primary mb-2">{t('inviteForm.whatHappensNext.title')}</h4>
                  <ul className="text-xs text-brand-primary space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-brand-primary mt-0.5">•</span>
                      <span>{t('inviteForm.whatHappensNext.step1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-primary mt-0.5">•</span>
                      <span>{t('inviteForm.whatHappensNext.step2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-primary mt-0.5">•</span>
                      <span>{t('inviteForm.whatHappensNext.step3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-primary mt-0.5">•</span>
                      <span>{t('inviteForm.whatHappensNext.step4', { 
                        name: isFreePlan 
                          ? 'Free Package Style' 
                          : (teamData?.activeContext?.name || 'Active Style')
                      })}</span>
                    </li>
                  </ul>
                </div>

                {allocatedPhotos * PRICING_CONFIG.credits.perGeneration > credits.team && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-red-800 text-sm font-medium">
                        {t('inviteForm.insufficientCreditsModal', { 
                          required: allocatedPhotos * PRICING_CONFIG.credits.perGeneration,
                          available: credits.team 
                        })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6">
                  <button
                    type="submit"
                    disabled={inviting || allocatedPhotos * PRICING_CONFIG.credits.perGeneration > credits.team}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium min-h-[44px] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                      allocatedPhotos * PRICING_CONFIG.credits.perGeneration > credits.team
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm hover:shadow-md disabled:opacity-50'
                    }`}
                  >
                    {inviting ? t('inviteForm.buttons.sending') : t('inviteForm.buttons.send')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteError(null)
                      // Clear form values when canceling
                      setEmailValue('')
                      setFirstNameValue('')
                      setPhotosInputValue(defaultPhotos.toString())
                      setAllocatedPhotos(defaultPhotos)
                      setShowInviteForm(false)
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 min-h-[44px] sm:w-auto font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                  >
                    {t('inviteForm.buttons.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}