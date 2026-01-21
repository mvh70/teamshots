'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import { Link } from '@/i18n/routing'
import { PlusIcon, EnvelopeIcon, CheckIcon, DocumentArrowUpIcon, BoltIcon } from '@heroicons/react/24/outline'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits, getRegenerationCount } from '@/domain/pricing'
import { getPricingTier } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { useCredits } from '@/contexts/CreditsContext'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { ErrorCard, Grid } from '@/components/ui'
import { Sparkles, Users, Camera, Image, XCircle, Info } from 'lucide-react'
import { trackTeamMemberInvited } from '@/lib/track'
import { getCleanClientBaseUrl } from '@/lib/url'

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
  isRevoked?: boolean
}

interface TeamData {
  id: string
  name: string
  activeContext?: {
    id: string
    name: string
  }
  seatInfo?: {
    totalSeats: number
    activeSeats: number
    availableSeats: number
    isSeatsModel: boolean
  } | null
}

interface TeamMember {
  id: string
  name: string
  userId?: string
  email?: string
  isAdmin?: boolean
  isCurrentUser?: boolean
  isRevoked?: boolean
  stats?: {
    selfies: number
    generations: number
    individualCredits: number
    teamCredits: number
    teamCreditsAllocated?: number
    teamCreditsUsed?: number
  }
}

export default function TeamPage() {
  const { data: session } = useSession()
  const t = useTranslations('team')
  const { credits, refetch: refetchCredits } = useCredits()
  const { isFreePlan, tier, period } = usePlanInfo()
  
  // Get regeneration count for invited users (same as team admin's plan)
  const invitedRegenerations = useMemo(() => {
    if (tier && period) {
      const pricingTier = getPricingTier(tier, period)
      return getRegenerationCount(pricingTier, period)
    }
    // Fallback to free as default
    return getRegenerationCount('free')
  }, [tier, period])
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
  const [revokingMember, setRevokingMember] = useState<string | null>(null)
  const [reactivating, setReactivating] = useState<string | null>(null)
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
  const [emailError, setEmailError] = useState<string | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [creatingLink, setCreatingLink] = useState(false)
  const [tableLinkCopied, setTableLinkCopied] = useState<string | null>(null)

  // Add photos modal state
  const [addPhotosInvite, setAddPhotosInvite] = useState<TeamInvite | null>(null)
  const [addPhotosValue, setAddPhotosValue] = useState('1')
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [addPhotosError, setAddPhotosError] = useState<string | null>(null)

  // Admin self-assignment state
  const [hasSelfAssigned, setHasSelfAssigned] = useState(false)
  const [selfAssigning, setSelfAssigning] = useState(false)
  const [selfAssignError, setSelfAssignError] = useState<string | null>(null)
  const [loadingSelfAssignStatus, setLoadingSelfAssignStatus] = useState(false)
  const [showSelfAssignPopover, setShowSelfAssignPopover] = useState(false)

  // Bulk invite modal state
  const [showBulkInviteForm, setShowBulkInviteForm] = useState(false)
  const [bulkInviteFile, setBulkInviteFile] = useState<File | null>(null)
  const [bulkInvitePreview, setBulkInvitePreview] = useState<{
    totalRowsParsed: number
    readyToImport: number
    duplicatesRemoved: number
    existingMembersSkipped: number
    seatsRequired: number
    seatsAvailable: number
    hasEnoughSeats: boolean
    previewRows: Array<{ email: string; firstName: string }>
    warnings: string[]
  } | null>(null)
  const [bulkInviteParsedData, setBulkInviteParsedData] = useState<Array<{ email: string; firstName: string }> | null>(null)
  const [bulkInviteLoading, setBulkInviteLoading] = useState(false)
  const [bulkInviteError, setBulkInviteError] = useState<string | null>(null)
  const [bulkInviteSuccess, setBulkInviteSuccess] = useState<{
    imported: number
    emailsSent: number
    emailsFailed: number
  } | null>(null)

  // Check if email is already part of the team
  const checkEmailInTeam = useCallback(async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase()
    
    // Basic email validation
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setEmailError(null)
      return
    }

    setCheckingEmail(true)
    setEmailError(null)

    try {
      const response = await fetch('/api/team/members/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      })

      const data = await response.json()

      if (response.ok) {
        if (data.isMember) {
          setEmailError(t('inviteForm.email.alreadyMember'))
        } else if (data.hasPendingInvite) {
          setEmailError(t('inviteForm.email.pendingInvite'))
        } else {
          setEmailError(null)
        }
      } else {
        // Don't show error for API errors, just log
        console.error('Error checking email:', data.error)
        setEmailError(null)
      }
    } catch (error) {
      // Don't show error for network errors, just log
      console.error('Error checking email:', error)
      setEmailError(null)
    } finally {
      setCheckingEmail(false)
    }
  }, [t])
  
  // Handle ESC key to close invite modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showInviteForm) {
        setShowInviteForm(false)
        setEmailValue('')
        setFirstNameValue('')
        setEmailError(null)
        setInviteError(null)
      }
    }

    if (showInviteForm) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showInviteForm])

  // Refresh invite data when tab becomes visible (to get updated tokens if expired links were visited)
  const lastVisibilityRefresh = useRef<number>(0)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only refresh if:
      // 1. Page is becoming visible
      // 2. Team data is loaded (we have something to refresh)
      // 3. User is team admin (they're the ones who see invite links)
      // 4. At least 30 seconds have passed since last refresh (debounce)
      if (
        document.visibilityState === 'visible' &&
        teamData &&
        userRoles.isTeamAdmin &&
        Date.now() - lastVisibilityRefresh.current > 30000
      ) {
        lastVisibilityRefresh.current = Date.now()
        // Silently refresh invite data in the background
        jsonFetcher<{ invites: TeamInvite[] }>('/api/team/invites')
          .then((invitesData) => {
            setInvites(invitesData.invites || [])
          })
          .catch((err) => {
            // Silently fail - don't show error to user for background refresh
            console.error('Background invite refresh failed:', err)
          })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [teamData, userRoles.isTeamAdmin])

  // Seats-based pricing: fixed 10 photos per seat (100 credits)
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
        // But validate team name - if it's suspicious (empty, null, or "My Team"), fetch fresh data
        try {
          const stored = sessionStorage.getItem('teamshots.initialData')
          if (stored) {
            const initialData = JSON.parse(stored)
            if (initialData.roles && initialData.onboarding) {
              const { isTeamAdmin, isTeamMember, isPlatformAdmin } = initialData.roles
              const { needsTeamSetup } = initialData.onboarding
              const teamId = initialData.roles.teamId
              const teamName = initialData.roles.teamName

              // Invalidate cache if team name is suspicious (empty, "My Team", etc)
              const isSuspiciousName = !teamName || 
                                       teamName.trim() === '' || 
                                       teamName === 'My Team' || 
                                       teamName === 'My team'
              
              // CRITICAL: If team has a valid name, ignore cached needsTeamSetup flag
              // The team name is the source of truth, not the cached onboarding state
              if (isSuspiciousName) {
                // Don't trust cached data - fetch fresh data from API
                console.log('Cached team name is suspicious, fetching fresh data from API')
                // Fall through to API fetch below
              } else {
                // Team has a valid name - use it regardless of cached needsTeamSetup flag
                setUserRoles({ isTeamAdmin, isTeamMember, isPlatformAdmin })

                if (isTeamAdmin) {
                  // Team has a valid name, so it's fully set up - show the team page
                  if (teamId && teamName) {
                    setNeedsTeamSetup(false) // Override cached value
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
              // CRITICAL: Team name is the source of truth, not needsTeamSetup flag
              // If team has a valid name, it's set up - ignore needsTeamSetup
              const hasValidTeamName = teamName && teamName.trim() !== '' && teamName !== 'My Team' && teamName !== 'My team'
              
              if (hasValidTeamName && teamId) {
                // Team has a valid name - show the team page
                console.log('Team has valid name, showing team page:', { teamId, teamName, needsTeamSetup })
                setNeedsTeamSetup(false) // Override API flag if team name is valid
                setTeamData({ id: teamId, name: teamName })
                await fetchTeamData()
              } else if (needsTeamSetup || !teamName || !teamId) {
                // Team needs setup (no name or no team)
                console.log('Team needs setup:', { teamId, teamName, needsTeamSetup })
                setNeedsTeamSetup(true)
                setLoading(false)
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
  /* eslint-disable react-you-might-not-need-an-effect/no-chain-state-updates */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-chain-state-updates */

  // Check if we should auto-open invite modal from onboarding.
  // The chained state updates are intentional: we need to initialize the form state
  // when opening the modal from onboarding. These are related initialization calls.
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
      setInviteError(null)
      setError(null)
    }
  }, [loading, teamData, userRoles.isTeamAdmin])

  const fetchTeamData = async () => {
    try {
      const [contextsData, invitesData, membersData] = await Promise.all([
        jsonFetcher<{ activeContext: { id: string; name: string } | undefined }>('/api/styles'),
        jsonFetcher<{ invites: TeamInvite[] }>('/api/team/invites'),
        jsonFetcher<{ 
          users: TeamMember[]
          seatInfo?: {
            totalSeats: number
            activeSeats: number
            availableSeats: number
            isSeatsModel: boolean
          } | null
        }>('/api/team/members')
      ])

      setTeamData(prevData => prevData ? { 
        ...prevData, 
        activeContext: contextsData.activeContext,
        seatInfo: membersData.seatInfo
      } : null)
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
        
        // Special handling for "already part of a team" error
        if (data.shouldRedirect && data.teamId) {
          setError(data.error || 'You are already part of a team. Redirecting...')
          // Fetch the team data and show it instead of the creation form
          setTimeout(async () => {
            try {
              await fetchTeamData()
              setNeedsTeamSetup(false)
            } catch {
              // If fetching fails, just reload the page
              window.location.reload()
            }
          }, 1500)
        } else {
          setError(data.error || 'Failed to create team.')
        }
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

    // Check if email is already a member (prevent submission)
    if (emailError) {
      setInviting(false)
      return
    }

    // Do a final check before submitting
    try {
      const checkResponse = await fetch('/api/team/members/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      })

      const checkData = await checkResponse.json()

      if (checkResponse.ok && (checkData.isMember || checkData.hasPendingInvite)) {
        if (checkData.isMember) {
          setEmailError(t('inviteForm.email.alreadyMember'))
        } else if (checkData.hasPendingInvite) {
          setEmailError(t('inviteForm.email.pendingInvite'))
        }
        setInviting(false)
        return
      }
    } catch (error) {
      // Continue with submission if check fails
      console.error('Error checking email before submit:', error)
    }

    // Check availability based on pricing model
    const isSeatsModel = teamData?.seatInfo?.isSeatsModel
    const availableSeats = teamData?.seatInfo?.availableSeats ?? 0

    // For credits-based teams, calculate required credits
    const standardPhotos = 10
    const creditsForInvite = standardPhotos * PRICING_CONFIG.credits.perGeneration

    if (isSeatsModel) {
      // Seats-based: check if seats are available
      if (availableSeats <= 0) {
        setInviteError(t('inviteForm.disabledReason.noAvailableSeats', { default: 'No available seats. Please purchase more seats.' }))
        setInviting(false)
        return
      }
    } else {
      // Credits-based: check if team has enough credits
      if (credits.team < creditsForInvite) {
        setInviteError(t('inviteForm.disabledReason.insufficientCredits', { default: 'Not enough photo credits. Please purchase more credits.' }))
        setInviting(false)
        return
      }
    }

    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          creditsAllocated: creditsForInvite
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Track successful invite
        trackTeamMemberInvited({
          team_id: data.invite?.id,
          invite_method: 'email'
        })

        await fetchTeamData()
        setShowInviteForm(false)
        setError(null)
        setInviteError(null)
        // Clear form values on success
        setEmailValue('')
        setFirstNameValue('')
        setEmailError(null)
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

  const handleCreateLink = async () => {
    setInviteError(null)
    setCreatingLink(true)

    const email = emailValue.trim()
    const firstName = firstNameValue.trim()

    if (!email || !firstName) {
      setInviteError('Email and first name are required')
      setCreatingLink(false)
      return
    }

    if (emailError) {
      setCreatingLink(false)
      return
    }

    // Check availability based on pricing model
    const isSeatsModel = teamData?.seatInfo?.isSeatsModel
    const availableSeats = teamData?.seatInfo?.availableSeats ?? 0

    // Calculate credits for invite (used for both models in API call)
    const standardPhotos = 10
    const creditsForInvite = standardPhotos * PRICING_CONFIG.credits.perGeneration

    if (isSeatsModel) {
      // Seats-based: check if seats are available
      if (availableSeats <= 0) {
        setInviteError(t('inviteForm.disabledReason.noAvailableSeats', { default: 'No available seats. Please purchase more seats.' }))
        setCreatingLink(false)
        return
      }
    } else {
      // Credits-based: check if team has enough credits
      if (credits.team < creditsForInvite) {
        setInviteError(t('inviteForm.disabledReason.insufficientCredits', { default: 'Not enough photo credits. Please purchase more credits.' }))
        setCreatingLink(false)
        return
      }
    }

    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          creditsAllocated: creditsForInvite,
          skipEmail: true
        })
      })

      const data = await response.json()

      if (response.ok) {
        trackTeamMemberInvited({
          team_id: data.invite?.id,
          invite_method: 'link'
        })

        // Refresh team data and close modal
        await fetchTeamData()
        setShowInviteForm(false)
        setError(null)
        setInviteError(null)
        // Clear form values
        setEmailValue('')
        setFirstNameValue('')
        setEmailError(null)
      } else {
        if (data.errorCode === 'INVALID_CREDIT_ALLOCATION' || data.errorCode === 'INSUFFICIENT_TEAM_CREDITS') {
          setInviteError(data.error)
        } else if (data.errorCode === 'NO_ACTIVE_CONTEXT') {
          setError(`${data.error} Click here to set up a context.`)
        } else {
          setInviteError(data.error)
        }
      }
    } catch {
      setInviteError('Failed to create invite link')
    } finally {
      setCreatingLink(false)
    }
  }

  const handleCopyInviteLink = async (link: string, rowId: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setTableLinkCopied(rowId)
      setTimeout(() => setTableLinkCopied(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setTableLinkCopied(rowId)
      setTimeout(() => setTableLinkCopied(null), 2000)
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

  const handleAddPhotos = async () => {
    if (!addPhotosInvite) return
    
    const photosToAdd = parseInt(addPhotosValue)
    if (isNaN(photosToAdd) || photosToAdd < 1) {
      setAddPhotosError(t('addPhotosModal.invalidAmount'))
      return
    }

    // Check if team has enough credits
    const creditsNeeded = photosToAdd * PRICING_CONFIG.credits.perGeneration
    if (credits.team < creditsNeeded) {
      setAddPhotosError(t('addPhotosModal.insufficientCredits', { available: calculatePhotosFromCredits(credits.team) }))
      return
    }

    setAddingPhotos(true)
    setAddPhotosError(null)
    
    try {
      const response = await fetch(`/api/team/invites/${addPhotosInvite.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photosToAdd })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTeamData()
        setSuccessMessage(t('addPhotosModal.success', { count: photosToAdd, name: addPhotosInvite.firstName || addPhotosInvite.email }))
        setAddPhotosInvite(null)
        setAddPhotosValue('1')
        setAddPhotosError(null)
      } else {
        setAddPhotosError(data.error || 'Failed to add photos')
      }
    } catch {
      setAddPhotosError('Failed to add photos')
    } finally {
      setAddingPhotos(false)
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

  const handleRevokeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to revoke this member\'s access to the team?')) {
      return
    }

    setRevokingMember(memberId)
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
      setError('Failed to revoke member access')
    } finally {
      setRevokingMember(null)
    }
  }

  const handleReactivateMember = async (memberId: string) => {
    setReactivating(memberId)
    try {
      const response = await fetch('/api/team/members/reactivate', {
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
      setError('Failed to reactivate member')
    } finally {
      setReactivating(null)
    }
  }

  const handleSelfAssignSeat = async () => {
    setSelfAssigning(true)
    setSelfAssignError(null)

    try {
      const response = await fetch('/api/team/admin/assign-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        setHasSelfAssigned(true)
        setShowSelfAssignPopover(false) // Close the popover
        await fetchTeamData()
        await refetchCredits() // Refresh credit balance
        setSuccessMessage(t('selfAssignment.success', { default: 'Successfully assigned seat to yourself! You now have 10 additional photos.' }))
        setSelfAssignError(null)
      } else {
        setSelfAssignError(data.error || 'Failed to assign seat')
      }
    } catch {
      setSelfAssignError('Failed to assign seat to yourself')
    } finally {
      setSelfAssigning(false)
    }
  }

  // Check self-assignment status on mount
  useEffect(() => {
    const checkSelfAssignmentStatus = async () => {
      if (!userRoles.isTeamAdmin || !teamData?.seatInfo?.isSeatsModel) {
        return
      }

      setLoadingSelfAssignStatus(true)
      try {
        const data = await jsonFetcher<{ hasSelfAssigned: boolean; isSeatsBasedTeam: boolean }>('/api/team/admin/assign-seat')
        setHasSelfAssigned(data.hasSelfAssigned)
      } catch (err) {
        console.error('Failed to check self-assignment status:', err)
      } finally {
        setLoadingSelfAssignStatus(false)
      }
    }

    void checkSelfAssignmentStatus()
  }, [userRoles.isTeamAdmin, teamData?.seatInfo?.isSeatsModel])

  // Removed unused formatInviteDate to satisfy linter

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  // Separate active and revoked members, then sort
  const { activeMembers, revokedMembers } = useMemo(() => {
    const active = teamMembers.filter(m => !m.isRevoked)
    const revoked = teamMembers.filter(m => m.isRevoked)

    // Sort active members: admins first, then non-admins
    const sortedActive = active.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1
      if (!a.isAdmin && b.isAdmin) return 1
      return 0
    })

    return { activeMembers: sortedActive, revokedMembers: revoked }
  }, [teamMembers])

  // Check if admin is already in the active members list (has a seat)
  const adminHasSeatInMembersList = useMemo(() => {
    return activeMembers.some(m => m.isCurrentUser && m.isAdmin)
  }, [activeMembers])
  
  // Filter out invites that are already active team members
  // An invite should only show as "pending" if:
  // 1. usedAt is null (not yet accepted), AND
  // 2. The invited email is not already an active team member
  const pendingInvites = useMemo(() => {
    const activeMemberEmails = new Set(
      activeMembers
        .filter(m => m.email)
        .map(m => m.email!.toLowerCase())
    )
    
    return invites.filter(invite => {
      // If usedAt is set, they already accepted - don't show as pending
      if (invite.usedAt) return false
      
      // If the email is already an active team member, don't show as pending invite
      if (activeMemberEmails.has(invite.email.toLowerCase())) return false
      
      return true
    })
  }, [invites, activeMembers])
  
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
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
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
    <div className="space-y-8 pb-8">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-gradient-to-r from-brand-secondary-light via-brand-secondary-lighter to-white border-2 border-brand-secondary-border rounded-2xl p-5 flex items-center gap-4 shadow-lg animate-fade-in">
          <div className="flex-shrink-0 w-12 h-12 bg-brand-secondary rounded-2xl flex items-center justify-center shadow-md ring-4 ring-brand-secondary/10">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <p className="text-brand-secondary-text-light font-semibold text-base">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div id="welcome-section" className="flex flex-col gap-8 mb-2">
        <div className="space-y-3">
          <h1 id="team-name-header" className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            {teamData?.name || t('title')}
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Team Stats Overview */}
      <div className={`grid grid-cols-1 gap-5 lg:gap-6 ${teamData?.seatInfo?.isSeatsModel ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {/* Team Members Card */}
        <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-brand-primary/20 transition-all duration-300 group overflow-hidden">
          {/* Decorative gradient background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-primary/[0.06] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative p-6">
            <div className="flex items-start gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-primary/5 rounded-xl flex items-center justify-center border border-brand-primary/10 group-hover:scale-105 transition-transform duration-300">
                  <Users className="h-7 w-7 text-brand-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {teamData?.seatInfo?.isSeatsModel ? t('teamMembers.headers.seatUsage') : 'Team members'}
                </p>
                <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">
                  {teamData?.seatInfo?.isSeatsModel
                    ? <><span className="text-brand-primary">{teamData.seatInfo.activeSeats}</span> <span className="text-lg font-semibold text-gray-400">{t('teamMembers.seatUsage.of')}</span> {teamData.seatInfo.totalSeats}</>
                    : (teamMembers?.length || 0) + (invites?.filter(inv => !inv.usedAt).length || 0)
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Available Photos Card - Only show for legacy credit-based teams */}
        {!teamData?.seatInfo?.isSeatsModel && (
          <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-brand-primary/20 transition-all duration-300 group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-primary/[0.06] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-6">
              <div className="flex items-start gap-5">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-primary/5 rounded-xl flex items-center justify-center border border-brand-primary/10 group-hover:scale-105 transition-transform duration-300">
                    <Camera className="h-7 w-7 text-brand-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Available photos</p>
                  <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{calculatePhotosFromCredits(credits.team)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photos Generated Card */}
        <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-brand-secondary/20 transition-all duration-300 group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-secondary/[0.06] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative p-6">
            <div className="flex items-start gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-secondary/15 via-brand-secondary/10 to-brand-secondary/5 rounded-xl flex items-center justify-center border border-brand-secondary/10 group-hover:scale-105 transition-transform duration-300">
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image className="h-7 w-7 text-brand-secondary" aria-hidden="true" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Photos generated</p>
                <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">
                  {teamMembers?.reduce((acc, member) => acc + (member.stats?.generations || 0), 0) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Required Notice - Only show if no active context and not free plan */}
      {userRoles.isTeamAdmin && !teamData?.activeContext && !isFreePlan && (
        <div id="setup-required-section" className="bg-gradient-to-br from-brand-primary-light via-brand-primary/10 to-white border-2 border-brand-primary-lighter rounded-2xl p-5 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg ring-4 ring-brand-primary/10">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-brand-primary font-bold text-lg block mb-1 tracking-tight">
                {t('setupRequired.title')}
              </h3>
              <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                {t('setupRequired.message')}
              </p>
              <Link
                href="/app/styles/team/create"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover text-sm font-semibold transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transform hover:-translate-y-0.5 shadow-md"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('setupRequired.createButton')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Free Plan Banner */}
      {isFreePlan && !teamData?.activeContext && (
        <div id="team-free-plan-banner" className="space-y-4">
          <FreePlanBanner variant="team" />
        </div>
      )}

      {/* Team Members & Invites */}
      <div className="relative">
        {/* Admin Self-Assignment Button - Top right of table (outside overflow container) */}
        {/* Only show when team has purchased seats (totalSeats > 0), not on free plan */}
        {userRoles.isTeamAdmin && teamData?.seatInfo?.isSeatsModel && teamData?.seatInfo?.totalSeats > 0 && !loadingSelfAssignStatus && !hasSelfAssigned && !adminHasSeatInMembersList && (
          <div className="absolute -top-12 right-0 z-10">
            <div className="relative">
              <button
                onClick={() => setShowSelfAssignPopover(!showSelfAssignPopover)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-cta text-white rounded-lg hover:bg-brand-cta-hover text-sm font-semibold transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-cta shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                {t('selfAssignment.buttonShort')}
              </button>

              {/* Popover */}
              {showSelfAssignPopover && (
                <>
                  {/* Backdrop to close popover */}
                  <div
                    className="fixed inset-0"
                    style={{ zIndex: 9998 }}
                    onClick={() => setShowSelfAssignPopover(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl p-4"
                    style={{ zIndex: 9999 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-brand-cta rounded-lg flex items-center justify-center shadow-md">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-brand-cta font-bold text-base mb-1">
                          {t('selfAssignment.title')}
                        </h3>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {t('selfAssignment.message')}
                    </p>
                    {selfAssignError && (
                      <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{selfAssignError}</p>
                      </div>
                    )}
                    {teamData.seatInfo.availableSeats > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSelfAssignSeat()
                        }}
                        disabled={selfAssigning}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-cta text-white rounded-lg hover:bg-brand-cta-hover text-sm font-semibold transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-cta shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selfAssigning ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('selfAssignment.assigning')}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            {t('selfAssignment.button')}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <Info className="h-4 w-4 inline mr-1" />
                          {t('selfAssignment.noSeatsAvailable')}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div id="team-invites-table" className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        {teamMembers.length === 0 && pendingInvites.length === 0 ? (
          <div className="p-12 text-center">
            {/* Seats-based teams with no seats: need to buy seats first */}
            {teamData?.seatInfo?.isSeatsModel && teamData?.seatInfo?.totalSeats === 0 ? (
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-brand-primary-light to-brand-primary-lighter rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-2 ring-brand-primary/20">
                  <svg className="h-8 w-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">{t('teamMembers.noSeats.title')}</h3>
                <p className="text-gray-600 mb-6 text-base leading-relaxed max-w-md mx-auto">
                  {t('teamMembers.noSeats.subtitle')}
                </p>
                <Link
                  href="/app/upgrade"
                  className="inline-block px-7 py-3.5 bg-brand-primary text-white rounded-xl hover:bg-brand-primary-hover transition-all text-center font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  {t('teamMembers.noSeats.button')}
                </Link>
              </>
            ) : credits.team === 0 && !teamData?.seatInfo?.isSeatsModel ? (
              /* Legacy credit-based teams with no credits */
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-2 ring-red-100">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">{t('teamInvites.noCredits.title')}</h3>
                <p className="text-gray-600 mb-6 text-base leading-relaxed max-w-md mx-auto">
                  {t('teamInvites.noCredits.subtitle')}
                </p>
                <Link
                  href={isFreePlan ? '/app/upgrade' : '/app/top-up'}
                  className="inline-block px-7 py-3.5 bg-brand-primary text-white rounded-xl hover:bg-brand-primary-hover transition-all text-center font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  {t('teamInvites.noCredits.button')}
                </Link>
              </>
            ) : (
              /* Default: has seats or credits, ready to invite */
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-2 ring-gray-100">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">{t('teamMembers.noMembers.title')}</h3>
                <p className="text-gray-600 mb-4 text-base leading-relaxed max-w-md mx-auto">
                  {t('teamMembers.noMembers.subtitle')}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: Table Layout */}
            <div className="hidden md:block">
                {/* Header row */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 via-gray-50/80 to-white border-b border-gray-100">
                  <div
                    className={`grid gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] ${
                      userRoles.isTeamAdmin
                        ? 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr_180px_140px]'
                        : 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr]'
                    }`}
                  >
                    <div>{t('teamMembers.headers.member')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.selfies')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.generations')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.remainingPhotos')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.status')}</div>
                    <div className="flex justify-center">{t('teamMembers.headers.photoStyle')}</div>
                    {userRoles.isTeamAdmin && (
                      <div className="flex justify-center">{t('teamMembers.headers.inviteLink', { default: 'Invite Link' })}</div>
                    )}
                    {userRoles.isTeamAdmin && (
                      <div className="flex justify-center">{t('teamMembers.headers.actions')}</div>
                    )}
                  </div>
                </div>
                
                {/* Team Members - Admins first, then non-admins */}
                {activeMembers.map((member) => {
                  // Find corresponding invite for this member
                  const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                  // Use stats from API (which includes admin allocations from invite_allocated transactions)
                  const creditsAllocated = member.stats?.teamCreditsAllocated ?? memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                  const creditsUsed = member.stats?.teamCreditsUsed ?? memberInvite?.creditsUsed ?? 0
                  const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                  // Build invite link from token if available
                  // Use clean base URL to avoid :80 port from reverse proxy headers
                  const inviteLink = memberInvite?.token ? `${getCleanClientBaseUrl()}/invite/${memberInvite.token}` : null

                  return (
                <div key={`member-${member.id}`} className="px-6 py-4 hover:bg-gradient-to-r hover:from-slate-50/50 hover:via-white hover:to-white transition-all duration-200 border-b border-gray-100/80 last:border-b-0 group">
                  <div
                    className={`grid gap-4 items-center ${
                      userRoles.isTeamAdmin
                        ? 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr_180px_140px]'
                        : 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr]'
                    }`}
                  >
                    {/* Member Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-primary/5 rounded-xl flex items-center justify-center flex-shrink-0 border border-brand-primary/10 group-hover:border-brand-primary/20 group-hover:scale-105 transition-all duration-200">
                        <span className="text-sm font-bold text-brand-primary">
                          {member.isCurrentUser
                            ? t('teamMembers.you')
                            : member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                          }
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">
                            {member.isCurrentUser ? 'You' : member.name}
                          </p>
                          {member.isAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 border border-amber-200/50 flex-shrink-0 uppercase tracking-wide">
                              {t('teamMembers.roles.teamAdmin')}
                            </span>
                          )}
                          {!member.isAdmin && member.userId && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-primary/5 text-brand-primary border border-brand-primary/10 flex-shrink-0 uppercase tracking-wide">
                              {t('teamMembers.roles.teamMember')}
                            </span>
                          )}
                          {!member.userId && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200/80 flex-shrink-0 uppercase tracking-wide">
                              {t('teamMembers.roles.guest')}
                            </span>
                          )}
                        </div>
                        {member.email && (
                          <p className="text-[11px] text-gray-400 truncate">{member.email}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {t('teamInvites.photosAllocated', { count: calculatePhotosFromCredits(creditsAllocated) })}
                          {creditsUsed > 0 && (
                            <span className="ml-1.5 text-brand-secondary font-medium">
                              • {t('teamInvites.photosUsed', { count: calculatePhotosFromCredits(creditsUsed) })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Selfies */}
                    <div className="flex justify-center">
                      {member.stats ? (
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">{member.stats.selfies}</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>

                    {/* Generations */}
                    <div className="flex justify-center">
                      {member.stats ? (
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">{member.stats.generations}</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>
                    
                    {/* Remaining Photos */}
                    <div className="flex justify-center items-center gap-1.5">
                      {memberInvite?.creditsRemaining !== undefined ? (
                        <>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums">
                            {calculatePhotosFromCredits(memberInvite.creditsRemaining)}
                          </span>
                          {/* Hide add photos button for seats-based teams */}
                          {userRoles.isTeamAdmin && !memberInvite.isRevoked && !teamData?.seatInfo?.isSeatsModel && (
                            <button
                              onClick={() => {
                                setAddPhotosInvite(memberInvite)
                                setAddPhotosValue('1')
                                setAddPhotosError(null)
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 hover:scale-110 transition-all"
                              title={t('teamInvites.actions.addPhotos')}
                            >
                              <span className="text-xs font-bold leading-none">+</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">
                          {member.isAdmin
                            ? (teamData?.seatInfo?.isSeatsModel
                                ? calculatePhotosFromCredits(credits.person ?? 0)
                                : calculatePhotosFromCredits(credits.team ?? 0))
                            : calculatePhotosFromCredits(creditsAllocated - creditsUsed)
                          }
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      {member.userId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-secondary/10 text-brand-secondary">
                          <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full"></span>
                          {t('teamMembers.status.registered')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-secondary/10 text-brand-secondary">
                          <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full"></span>
                          {t('teamMembers.status.guest')}
                        </span>
                      )}
                    </div>

                    {/* Photo Style - Admins don't have an assigned style */}
                    <div className="flex justify-center">
                      {photoStyle && !member.isAdmin ? (
                        <Link
                          href="/app/styles/team"
                          className="text-[13px] font-medium text-brand-primary hover:text-brand-primary-hover underline decoration-1 underline-offset-2 transition-colors truncate max-w-[120px]"
                          title={photoStyle}
                        >
                          {photoStyle}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>

                    {/* Invite Link - Admin only */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex justify-center">
                        {inviteLink && !member.isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleCopyInviteLink(inviteLink, member.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-200 ${
                              tableLinkCopied === member.id
                                ? 'text-brand-secondary bg-brand-secondary/10'
                                : 'text-gray-500 bg-gray-100/80 hover:bg-gray-100 hover:text-gray-700'
                            }`}
                            title={t('teamMembers.copyInviteLink', { default: 'Copy invite link' })}
                          >
                            {tableLinkCopied === member.id ? (
                              <>
                                <CheckIcon className="w-3 h-3" />
                                {t('teamMembers.copied', { default: 'Copied!' })}
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {t('teamMembers.copyLink', { default: 'Copy' })}
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </div>
                    )}

                    {/* Admin Actions */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex items-center justify-center gap-1.5">
                        {memberInvite && (
                          <button
                            onClick={() => handleResendInvite(memberInvite.id)}
                            disabled={resending === memberInvite.id}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg text-gray-600 bg-gray-100/80 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 font-semibold transition-all duration-200"
                          >
                            {resending === memberInvite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                          </button>
                        )}
                        {!member.isCurrentUser && (
                          <button
                            onClick={() => handleRevokeMember(member.id)}
                            disabled={revokingMember === member.id}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 font-semibold transition-all duration-200"
                          >
                            {revokingMember === member.id ? t('teamMembers.actions.revoking') : t('teamMembers.actions.revoke')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                  )
                })}

                {/* Revoked Members Section */}
                {revokedMembers.length > 0 && userRoles.isTeamAdmin && (
                  <>
                    <div className="px-7 py-4 border-t-2 border-gray-200 mt-4">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        {t('teamMembers.revoked.title', { count: revokedMembers.length })}
                      </h3>
                    </div>
                    {revokedMembers.map((member) => {
                      const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                      const creditsAllocated = memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                      const creditsUsed = memberInvite?.creditsUsed ?? 0
                      const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                      
                      return (
                        <div key={`revoked-${member.id}`} className="px-7 py-5 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-white transition-all duration-200 border-b border-gray-100 last:border-b-0 group opacity-60">
                          <div
                            className={`grid gap-6 items-center ${
                              userRoles.isTeamAdmin
                                ? 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr_180px_140px]'
                                : 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr]'
                            }`}
                          >
                            {/* Member Info */}
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-gray-300/50 group-hover:ring-gray-400/50 transition-all shadow-sm">
                                <span className="text-sm font-bold text-gray-600">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <p className="text-base font-semibold text-gray-600 truncate">
                                    {member.name}
                                  </p>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
                                    {t('teamMembers.status.revoked')}
                                  </span>
                                </div>
                                {member.email && (
                                  <p className="text-xs text-gray-400 truncate font-medium">{member.email}</p>
                                )}
                                {!member.isAdmin && (
                                  <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                    {t('teamInvites.photosAllocated', { count: calculatePhotosFromCredits(creditsAllocated) })}
                                    {creditsUsed > 0 && (
                                      <span className="ml-2 text-gray-500 font-semibold">
                                        • {t('teamInvites.photosUsed', { count: calculatePhotosFromCredits(creditsUsed) })}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Selfies */}
                            <div className="flex justify-center">
                              {member.stats ? (
                                <span className="text-base font-bold text-gray-500">{member.stats.selfies}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                            
                            {/* Generations */}
                            <div className="flex justify-center">
                              {member.stats ? (
                                <span className="text-base font-bold text-gray-500">{member.stats.generations}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                            
                            {/* Remaining Photos */}
                            <div className="flex justify-center">
                              {memberInvite?.creditsRemaining !== undefined ? (
                                <span className="text-base font-bold text-gray-500">
                                  {calculatePhotosFromCredits(memberInvite.creditsRemaining)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                            
                            {/* Status */}
                            <div className="flex justify-center">
                              <div className="flex items-center justify-center gap-2 text-red-600">
                                <div className="w-2 h-2 bg-red-600 rounded-full ring-2 ring-red-600/20"></div>
                                <span className="text-sm font-semibold">{t('teamMembers.status.revoked')}</span>
                              </div>
                            </div>

                            {/* Photo Style */}
                            <div className="flex justify-center">
                              {photoStyle ? (
                                <Link
                                  href="/app/styles/team"
                                  className="text-sm font-semibold text-gray-500 hover:text-gray-600 underline decoration-2 underline-offset-2 transition-colors truncate max-w-[120px]"
                                  title={photoStyle}
                                >
                                  {photoStyle}
                                </Link>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>

                            {/* Invite Link - Admin only (empty for revoked) */}
                            {userRoles.isTeamAdmin && (
                              <div className="flex justify-center">
                                <span className="text-sm text-gray-400">-</span>
                              </div>
                            )}

                            {/* Admin Actions */}
                            {userRoles.isTeamAdmin && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleReactivateMember(member.id)}
                                  disabled={reactivating === member.id}
                                  className="text-xs px-3.5 py-2 rounded-lg text-green-600 border border-green-600/30 hover:bg-green-50 hover:border-green-600/50 disabled:opacity-50 font-medium transition-all duration-200"
                                >
                                  {reactivating === member.id ? t('teamMembers.actions.reactivating') : t('teamMembers.actions.reactivate')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Team Invites - only show pending invites */}
                {pendingInvites.map((invite) => {
                  // Build invite link from token
                  // Use clean base URL to avoid :80 port from reverse proxy headers
                  const inviteLink = invite.token ? `${getCleanClientBaseUrl()}/invite/${invite.token}` : null

                  return (
                <div key={`invite-${invite.id}`} className="px-7 py-5 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-white transition-all duration-200 border-b border-gray-100 last:border-b-0 group">
                  <div
                    className={`grid gap-6 items-center ${
                      userRoles.isTeamAdmin
                        ? 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr_180px_140px]'
                        : 'grid-cols-[250px_1fr_1fr_1fr_1fr_1fr]'
                    }`}
                  >
                    {/* Invite Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200/50 group-hover:ring-gray-300/50 transition-all shadow-sm">
                        <EnvelopeIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-900 truncate">
                          {invite.firstName || invite.email}
                        </p>
                        {invite.firstName && invite.email && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{invite.email}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1.5 font-medium">
                          {t('teamInvites.creditsAllocated', { count: calculatePhotosFromCredits(invite.creditsAllocated) })}
                          {invite.usedAt && invite.creditsUsed !== undefined && invite.creditsUsed > 0 && (
                            <span className="ml-2 text-brand-cta font-semibold">
                              • {t('teamInvites.creditsUsed', { count: calculatePhotosFromCredits(invite.creditsUsed) })}
                            </span>
                          )}
                        </p>
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
                      <span className="text-base font-bold text-gray-900">{calculatePhotosFromCredits(invite.creditsAllocated)}</span>
                    </div>
                    
                    {/* Status */}
                    <div className="flex justify-center">
                      {invite.usedAt ? (
                        <div className="flex items-center justify-center gap-2 text-brand-secondary">
                          <div className="w-2 h-2 bg-brand-secondary rounded-full ring-2 ring-brand-secondary/20 animate-pulse"></div>
                          <span className="text-sm font-semibold">{t('teamInvites.status.accepted')}</span>
                        </div>
                      ) : invite.isRevoked ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <div className="w-2 h-2 bg-gray-500 rounded-full ring-2 ring-gray-500/20"></div>
                          <span className="text-sm font-semibold">{t('teamInvites.status.revoked')}</span>
                        </div>
                      ) : isExpired(invite.expiresAt) ? (
                        <div className="flex items-center justify-center gap-2 text-red-600">
                          <div className="w-2 h-2 bg-red-600 rounded-full ring-2 ring-red-600/20"></div>
                          <span className="text-sm font-semibold">{t('teamInvites.status.expired')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-yellow-600">
                          <div className="w-2 h-2 bg-yellow-600 rounded-full ring-2 ring-yellow-600/20 animate-pulse"></div>
                          <span className="text-sm font-semibold">{t('teamInvites.status.pending')}</span>
                        </div>
                      )}
                    </div>

                    {/* Photo Style */}
                    <div className="flex justify-center">
                      {invite.contextName ? (
                        <Link
                          href="/app/styles/team"
                          className="text-sm font-semibold text-brand-primary hover:text-brand-primary-hover underline decoration-2 underline-offset-2 transition-colors truncate max-w-[120px]"
                          title={invite.contextName}
                        >
                          {invite.contextName}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>

                    {/* Invite Link - Admin only */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex justify-center">
                        {inviteLink && !invite.isRevoked ? (
                          <button
                            type="button"
                            onClick={() => handleCopyInviteLink(inviteLink, invite.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              tableLinkCopied === invite.id
                                ? 'text-green-700 bg-green-100'
                                : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                            }`}
                            title={t('teamMembers.copyInviteLink', { default: 'Copy invite link' })}
                          >
                            {tableLinkCopied === invite.id ? (
                              <>
                                <CheckIcon className="w-3.5 h-3.5" />
                                {t('teamMembers.copied', { default: 'Copied!' })}
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {t('teamMembers.copyLink', { default: 'Copy' })}
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    )}

                    {/* Admin Actions */}
                    {userRoles.isTeamAdmin && (
                      <div className="flex items-center justify-center gap-2.5">
                        <button
                          onClick={() => handleResendInvite(invite.id)}
                          disabled={resending === invite.id}
                          className="text-xs px-3.5 py-2 rounded-lg text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 hover:border-brand-primary/50 disabled:opacity-50 font-medium transition-all duration-200"
                        >
                          {resending === invite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                        </button>
                        {/* Hide revoke button when already revoked or used */}
                        {!invite.usedAt && !invite.isRevoked && (
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
                            disabled={revoking === invite.id}
                            className="text-xs px-3.5 py-2 rounded-lg text-red-600 border border-red-600/30 hover:bg-red-50 hover:border-red-600/50 disabled:opacity-50 font-medium transition-all duration-200"
                          >
                            {revoking === invite.id ? t('teamInvites.actions.revoking') : t('teamInvites.actions.revoke')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>

              {/* Mobile: Card Layout */}
              <div className="md:hidden divide-y divide-gray-200">
                {/* Team Members - Admins first, then non-admins */}
                {activeMembers.map((member) => {
                  // Find corresponding invite for this member
                  const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                  // Use stats from API (which includes admin allocations from invite_allocated transactions)
                  const creditsAllocated = member.stats?.teamCreditsAllocated ?? memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                  const creditsUsed = member.stats?.teamCreditsUsed ?? memberInvite?.creditsUsed ?? 0
                  const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                  
                  return (
                <div key={`member-${member.id}`} className="p-5 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-white transition-all duration-200 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-primary-light to-brand-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-brand-primary/5 shadow-sm">
                      <span className="text-sm font-bold text-brand-primary">
                        {member.isCurrentUser 
                          ? t('teamMembers.you') 
                          : member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        }
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-base font-semibold text-gray-900">
                          {member.isCurrentUser ? 'You' : member.name}
                        </p>
                        {member.isAdmin && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-premium/10 to-brand-premium/5 text-brand-premium border border-brand-premium/20">
                            {t('teamMembers.roles.teamAdmin')}
                          </span>
                        )}
                        {!member.isAdmin && member.userId && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-primary-light to-brand-primary/10 text-brand-primary border border-brand-primary/20">
                            {t('teamMembers.roles.teamMember')}
                          </span>
                        )}
                        {!member.userId && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
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
                    <Grid cols={{ mobile: 2 }} gap="sm" className="mb-5 pl-[64px]">
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">{t('teamMembers.headers.selfies')}</p>
                        <p className="text-lg font-bold text-gray-900">{member.stats.selfies}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">{t('teamMembers.headers.generations')}</p>
                        <p className="text-lg font-bold text-gray-900">{member.stats.generations}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">{t('teamMembers.headers.remainingPhotos')}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-lg font-bold text-gray-900">
                            {member.isAdmin 
                              ? (teamData?.seatInfo?.isSeatsModel 
                                  ? calculatePhotosFromCredits(credits.person ?? 0)
                                  : calculatePhotosFromCredits(credits.team ?? 0))
                              : calculatePhotosFromCredits(memberInvite?.creditsRemaining ?? 0)
                            }
                          </p>
                          {/* Hide add photos button for seats-based teams */}
                          {!member.isAdmin && memberInvite && userRoles.isTeamAdmin && !memberInvite.isRevoked && !teamData?.seatInfo?.isSeatsModel && (
                            <button
                              onClick={() => {
                                setAddPhotosInvite(memberInvite)
                                setAddPhotosValue('1')
                                setAddPhotosError(null)
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 transition-colors"
                              title={t('teamInvites.actions.addPhotos')}
                            >
                              <span className="text-sm font-bold leading-none">+</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </Grid>
                  )}

                  {/* Status */}
                  <div className="mb-5 pl-[64px]">
                    {member.userId ? (
                      <div className="flex items-center gap-2 text-brand-secondary">
                        <div className="w-2 h-2 bg-brand-secondary rounded-full ring-2 ring-brand-secondary/20"></div>
                        <span className="text-sm font-semibold">{t('teamMembers.status.registered')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-brand-secondary">
                        <div className="w-2 h-2 bg-brand-secondary rounded-full ring-2 ring-brand-secondary/20"></div>
                        <span className="text-sm font-semibold">{t('teamMembers.status.guest')}</span>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {userRoles.isTeamAdmin && (
                    <div className="flex flex-wrap gap-2.5 pl-[64px]">
                      {memberInvite && (
                        <button
                          onClick={() => handleResendInvite(memberInvite.id)}
                          disabled={resending === memberInvite.id}
                          className="text-xs px-3.5 py-2 rounded-lg text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 hover:border-brand-primary/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
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
                              className="text-xs px-3.5 py-2 rounded-lg text-brand-premium border border-brand-premium/30 hover:bg-brand-premium/10 hover:border-brand-premium/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
                            >
                              {changingRole === member.id ? t('teamMembers.actions.promoting') : t('teamMembers.actions.makeAdmin')}
                            </button>
                          )}
                          {member.isAdmin && (
                            <button
                              onClick={() => handleChangeMemberRole(member.id, 'team_member')}
                              disabled={changingRole === member.id}
                              className="text-xs px-3.5 py-2 rounded-lg text-brand-cta border border-brand-cta/30 hover:bg-brand-cta/10 hover:border-brand-cta/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
                            >
                              {changingRole === member.id ? t('teamMembers.actions.demoting') : t('teamMembers.actions.demote')}
                            </button>
                          )}
                        </>
                      )}
                      {!member.isCurrentUser && (
                        <button
                          onClick={() => handleRevokeMember(member.id)}
                          disabled={revokingMember === member.id}
                          className="text-xs px-3.5 py-2 rounded-lg text-red-600 border border-red-600/30 hover:bg-red-50 hover:border-red-600/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
                        >
                          {revokingMember === member.id ? t('teamMembers.actions.revoking') : t('teamMembers.actions.revoke')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                  )
                })}

                {/* Revoked Members Section - Mobile */}
                {revokedMembers.length > 0 && userRoles.isTeamAdmin && (
                  <>
                    <div className="p-5 border-t-2 border-gray-200 mt-4">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        {t('teamMembers.revoked.title', { count: revokedMembers.length })}
                      </h3>
                    </div>
                    {revokedMembers.map((member) => {
                      const memberInvite = member.email ? invitesByEmail.get(member.email.toLowerCase()) : null
                      const creditsAllocated = memberInvite?.creditsAllocated ?? member.stats?.teamCredits ?? 0
                      const creditsUsed = memberInvite?.creditsUsed ?? 0
                      const photoStyle = memberInvite?.contextName ?? teamData?.activeContext?.name
                      
                      return (
                        <div key={`revoked-mobile-${member.id}`} className="p-5 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-white transition-all duration-200 border-b border-gray-100 last:border-b-0 opacity-60">
                          <div className="flex items-start gap-4 mb-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-gray-300/50 shadow-sm">
                              <span className="text-sm font-bold text-gray-600">
                                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <p className="text-base font-semibold text-gray-600">
                                  {member.name}
                                </p>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                  {t('teamMembers.status.revoked')}
                                </span>
                              </div>
                              {member.email && (
                                <p className="text-xs text-gray-400">{member.email}</p>
                              )}
                              {!member.isAdmin && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {t('teamInvites.photosAllocated', { count: calculatePhotosFromCredits(creditsAllocated) })}
                                  {creditsUsed > 0 && (
                                    <span className="ml-2 text-gray-500">
                                      • {t('teamInvites.photosUsed', { count: calculatePhotosFromCredits(creditsUsed) })}
                                    </span>
                                  )}
                                </p>
                              )}
                              {photoStyle && !member.isAdmin && (
                                <p className="text-xs text-gray-400 mt-1">
                                  Photo style:{' '}
                                  <Link 
                                    href="/app/styles/team"
                                    className="text-gray-500 hover:text-gray-600 underline"
                                  >
                                    {photoStyle}
                                  </Link>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Stats Grid */}
                          {member.stats && (
                            <div className="mb-5 pl-[64px]">
                              <Grid cols={{ mobile: 2, tablet: 2, desktop: 2 }} gap="md">
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">{t('teamMembers.headers.selfies')}</p>
                                  <p className="text-base font-bold text-gray-500">{member.stats.selfies}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">{t('teamMembers.headers.generations')}</p>
                                  <p className="text-base font-bold text-gray-500">{member.stats.generations}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">{t('teamMembers.headers.remainingPhotos')}</p>
                                  <p className="text-base font-bold text-gray-500">
                                    {calculatePhotosFromCredits(memberInvite?.creditsRemaining ?? 0)}
                                  </p>
                                </div>
                              </Grid>
                            </div>
                          )}

                          {/* Status */}
                          <div className="mb-5 pl-[64px]">
                            <div className="flex items-center gap-2 text-red-600">
                              <div className="w-2 h-2 bg-red-600 rounded-full ring-2 ring-red-600/20"></div>
                              <span className="text-sm font-semibold">{t('teamMembers.status.revoked')}</span>
                            </div>
                          </div>

                          {/* Admin Actions */}
                          {userRoles.isTeamAdmin && (
                            <div className="flex flex-wrap gap-2.5 pl-[64px]">
                              <button
                                onClick={() => handleReactivateMember(member.id)}
                                disabled={reactivating === member.id}
                                className="text-xs px-3.5 py-2 rounded-lg text-green-600 border border-green-600/30 hover:bg-green-50 hover:border-green-600/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
                              >
                                {reactivating === member.id ? t('teamMembers.actions.reactivating') : t('teamMembers.actions.reactivate')}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Team Invites - only show pending invites */}
                {pendingInvites.map((invite) => (
                <div key={`invite-${invite.id}`} className="p-5 hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-white transition-all duration-200 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200/50 shadow-sm">
                      <EnvelopeIcon className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-900 break-words">
                        {invite.firstName || invite.email}
                      </p>
                      {invite.firstName && invite.email && (
                        <p className="text-xs text-gray-500 mt-0.5">{invite.email}</p>
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
                  <div className="mb-5 pl-[64px]">
                    {invite.usedAt ? (
                      <div className="flex items-center gap-2 text-brand-secondary">
                        <div className="w-2 h-2 bg-brand-secondary rounded-full ring-2 ring-brand-secondary/20 animate-pulse"></div>
                        <span className="text-sm font-semibold">{t('teamInvites.status.accepted')}</span>
                      </div>
                    ) : invite.isRevoked ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-2 h-2 bg-gray-500 rounded-full ring-2 ring-gray-500/20"></div>
                        <span className="text-sm font-semibold">{t('teamInvites.status.revoked')}</span>
                      </div>
                    ) : isExpired(invite.expiresAt) ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <div className="w-2 h-2 bg-red-600 rounded-full ring-2 ring-red-600/20"></div>
                        <span className="text-sm font-semibold">{t('teamInvites.status.expired')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <div className="w-2 h-2 bg-yellow-600 rounded-full ring-2 ring-yellow-600/20 animate-pulse"></div>
                        <span className="text-sm font-semibold">{t('teamInvites.status.pending')}</span>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {userRoles.isTeamAdmin && (
                    <div className="flex flex-wrap gap-2.5 pl-[64px]">
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={resending === invite.id}
                        className="text-xs px-3.5 py-2 rounded-lg text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 hover:border-brand-primary/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
                      >
                        {resending === invite.id ? t('teamInvites.actions.resending') : t('teamInvites.actions.resend')}
                      </button>
                      {/* Hide revoke button when already revoked or used */}
                      {!invite.usedAt && !invite.isRevoked && (
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revoking === invite.id}
                          className="text-xs px-3.5 py-2 rounded-lg text-red-600 border border-red-600/30 hover:bg-red-50 hover:border-red-600/50 disabled:opacity-50 min-h-[44px] font-medium transition-all duration-200"
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
      </div>

      {/* Invite Team Member Button - Below table */}
      {/* Show for: admins with active context, free plan, OR seats-based teams (need to set up style to use) */}
      {userRoles.isTeamAdmin && (teamData?.activeContext || isFreePlan || teamData?.seatInfo?.isSeatsModel) && (
        <div className="flex justify-center mt-6">
          {isFreePlan ? (
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl shadow-md bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              <PlusIcon className="h-5 w-5" />
              {t('buttons.upgradeToInvite')}
            </button>
          ) : !teamData?.activeContext && teamData?.seatInfo?.isSeatsModel ? (
            // Seats-based team without photo style - prompt to set up first
            <Link
              href="/app/styles/team/create"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
            >
              <PlusIcon className="h-5 w-5" />
              {t('setupRequired.createButton')}
            </Link>
          ) : credits.team === 0 ? (
            <Link
              href="/app/top-up"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-r from-brand-cta to-brand-cta-hover hover:from-brand-cta-hover hover:to-indigo-600"
            >
              <PlusIcon className="h-5 w-5" />
              {t('buttons.buyCredits')}
            </Link>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setInviteError(null)
                  setError(null)
                  setEmailValue('')
                  setFirstNameValue('')
                  setShowInviteForm(true)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors duration-150 bg-brand-secondary hover:bg-brand-secondary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary"
              >
                <PlusIcon className="h-4 w-4" />
                {t('buttons.inviteTeamMember')}
              </button>
              <button
                onClick={() => {
                  setBulkInviteError(null)
                  setBulkInviteFile(null)
                  setBulkInvitePreview(null)
                  setBulkInviteParsedData(null)
                  setBulkInviteSuccess(null)
                  setShowBulkInviteForm(true)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 bg-white transition-colors duration-150 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
              >
                <DocumentArrowUpIcon className="h-4 w-4" />
                {t('buttons.bulkInvite', { default: 'Bulk Invite' })}
              </button>
              <Link
                href="/app/settings?tab=integrations"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 bg-white transition-colors duration-150 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
              >
                <BoltIcon className="h-4 w-4" />
                {t('buttons.zapierIntegration', { default: 'Automate with Zapier' })}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[110] overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl animate-scale-in border border-gray-200">
            <div className="p-7 sm:p-9">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">
                {t('inviteForm.title')}
              </h2>

              <form onSubmit={handleInviteTeamMember} className="space-y-6" noValidate>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                    {t('inviteForm.email.label')} *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={emailValue}
                    onChange={(e) => {
                      setEmailValue(e.target.value)
                      // Clear error when user starts typing
                      if (emailError) {
                        setEmailError(null)
                      }
                    }}
                    onBlur={(e) => {
                      const email = e.target.value.trim()
                      if (email) {
                        checkEmailInTeam(email)
                      }
                    }}
                    className={`w-full px-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all shadow-sm ${
                      emailError
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-brand-primary/20 focus:border-brand-primary hover:border-gray-300'
                    }`}
                    placeholder={t('inviteForm.email.placeholder')}
                  />
                  {checkingEmail && (
                    <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div>
                      {t('inviteForm.email.checking')}
                    </p>
                  )}
                  {emailError && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                    {t('inviteForm.firstName.label')} *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={firstNameValue}
                    onChange={(e) => setFirstNameValue(e.target.value)}
                    className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm hover:border-gray-300"
                    placeholder={t('inviteForm.firstName.placeholder')}
                  />
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    Personalizes the invite email
                  </p>
                </div>

                {/* Hidden input for fixed 10 photos allocation */}
                <input type="hidden" name="photosAllocated" value="10" />

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">
                    {t('inviteForm.photoStyle.label', { default: 'Photo Style' })}
                  </label>
                  {isFreePlan ? (
                    // Free plan: Show static message about free package style (no choice)
                    <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-sm font-semibold text-gray-900 mb-2">
                        {t('inviteForm.photoStyle.useFreePackageStyle', { 
                          default: 'Free Package Style',
                          name: 'Free Package Style'
                        })}
                      </div>
                      <div className="text-xs text-gray-600 font-medium leading-relaxed">
                        {t('inviteForm.photoStyle.useFreePackageStyleDesc', { 
                          default: 'Team member will use the free package photo style. This cannot be changed for free plan accounts.'
                        })}
                      </div>
                      {/* Hidden input to ensure form submission works */}
                      <input type="hidden" name="photoStyleType" value="context" />
                    </div>
                  ) : (
                    // Paid plan: Show radio button choices
                    <div className="space-y-4">
                      <label className="flex items-start p-4 border-2 border-gray-200 rounded-xl hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all cursor-pointer group">
                        <input
                          type="radio"
                          name="photoStyleType"
                          value="context"
                          defaultChecked
                          className="h-5 w-5 text-brand-primary focus:ring-brand-primary border-gray-300 mt-0.5"
                        />
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900 mb-1">
                            {t('inviteForm.photoStyle.useActiveStyle', { default: 'Use Active Photo Style' })}
                          </div>
                          <div className="text-xs text-gray-600 font-medium">
                            {(() => {
                              const styleName = teamData?.activeContext?.name || 'Active Style'
                              const baseText = t('inviteForm.photoStyle.useActiveStyleDesc', { 
                                default: 'Team member will use the predefined photo style',
                                name: styleName
                              })
                              const parts = baseText.split(': ')
                              if (parts.length > 1) {
                                return (
                                  <>
                                    {parts[0]}: <span className="font-bold text-gray-700">{parts.slice(1).join(': ')}</span>
                                  </>
                                )
                              }
                              return baseText
                            })()}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start p-4 border-2 border-gray-200 rounded-xl hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all cursor-pointer group">
                        <input
                          type="radio"
                          name="photoStyleType"
                          value="freestyle"
                          className="h-5 w-5 text-brand-primary focus:ring-brand-primary border-gray-300 mt-0.5"
                        />
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900 mb-1">
                            {t('inviteForm.photoStyle.allowFreestyle', { default: 'Allow Freestyle' })}
                          </div>
                          <div className="text-xs text-gray-600 font-medium">
                            {t('inviteForm.photoStyle.allowFreestyleDesc', { 
                              default: 'Team member can customize their own photo style'
                            })}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-brand-primary-light to-brand-primary/5 border-2 border-brand-primary/20 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-brand-primary mb-3">{t('inviteForm.whatHappensNext.title')}</h4>
                  <ul className="text-xs text-brand-primary space-y-2 font-medium">
                    <li className="flex gap-2">
                      <span className="text-brand-primary flex-shrink-0">•</span>
                      <span>{t('inviteForm.whatHappensNext.step1')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand-primary flex-shrink-0">•</span>
                      <span>{t('inviteForm.whatHappensNext.step3')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand-primary flex-shrink-0">•</span>
                      <span>Each team member gets 10 photos</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-8">
                    {(() => {
                      // Compute disabled reason for tooltip
                      const isSeatsModel = teamData?.seatInfo?.isSeatsModel
                      const availableSeats = teamData?.seatInfo?.availableSeats ?? 0

                      const getDisabledReason = () => {
                        if (inviting) return t('inviteForm.disabledReason.sending', { default: 'Sending invite...' })
                        if (creatingLink) return t('inviteForm.disabledReason.creatingLink', { default: 'Creating link...' })
                        if (checkingEmail) return t('inviteForm.disabledReason.checkingEmail', { default: 'Checking email...' })
                        if (!emailValue.trim()) return t('inviteForm.disabledReason.emailRequired', { default: 'Please enter an email address' })
                        if (!firstNameValue.trim()) return t('inviteForm.disabledReason.firstNameRequired', { default: 'Please enter a first name' })
                        if (emailError) return emailError
                        // Check availability based on pricing model
                        if (isSeatsModel) {
                          if (availableSeats <= 0) return t('inviteForm.disabledReason.noAvailableSeats', { default: 'No available seats. Please purchase more seats.' })
                        } else {
                          if (credits.team < 100) return t('inviteForm.disabledReason.insufficientCredits', { default: 'Not enough photo credits. Please purchase more credits.' })
                        }
                        return undefined
                      }
                      const disabledReason = getDisabledReason()
                      const isDisabled = !!disabledReason

                      return (
                        <>
                          <div className="relative flex-1 group">
                            <button
                              type="submit"
                              disabled={isDisabled}
                              className={`w-full px-7 py-3.5 rounded-xl font-semibold text-base min-h-[48px] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                                isDisabled
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-md hover:shadow-lg disabled:opacity-50 transform hover:-translate-y-0.5'
                              }`}
                            >
                              {inviting ? t('inviteForm.buttons.sending') : t('inviteForm.buttons.send')}
                            </button>
                            {isDisabled && disabledReason && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                {disabledReason}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                              </div>
                            )}
                          </div>
                          <div className="relative flex-1 group">
                            <button
                              type="button"
                              onClick={handleCreateLink}
                              disabled={isDisabled}
                              className={`w-full px-7 py-3.5 rounded-xl font-semibold text-base min-h-[48px] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary border-2 ${
                                isDisabled
                                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-white text-brand-secondary border-brand-secondary hover:bg-brand-secondary/10 shadow-sm hover:shadow disabled:opacity-50'
                              }`}
                            >
                              {creatingLink ? t('inviteForm.buttons.creatingLink', { default: 'Creating...' }) : t('inviteForm.buttons.createLink', { default: 'Create Link' })}
                            </button>
                            {isDisabled && disabledReason && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                {disabledReason}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInviteError(null)
                              // Clear form values when canceling
                              setEmailValue('')
                              setFirstNameValue('')
                              setEmailError(null)
                              setShowInviteForm(false)
                            }}
                            className="px-7 py-3.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 min-h-[48px] sm:w-auto font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 shadow-sm hover:shadow"
                          >
                            {t('inviteForm.buttons.cancel')}
                          </button>
                        </>
                      )
                    })()}
                  </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Invite Modal */}
      {showBulkInviteForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[110] overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl animate-scale-in border border-gray-200">
            <div className="p-7 sm:p-9">
              <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                {t('bulkInviteForm.title', { default: 'Bulk Invite' })}
              </h2>
              <p className="text-gray-600 mb-6">
                {t('bulkInviteForm.description', { default: 'Upload a CSV file with team member emails and names to invite multiple people at once.' })}
              </p>

              {/* Success State */}
              {bulkInviteSuccess && (
                <div className="space-y-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckIcon className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-green-800">
                        {t('bulkInviteForm.success.title', { default: 'Import Complete!' })}
                      </h3>
                    </div>
                    <div className="space-y-2 text-sm text-green-700">
                      <p>{t('bulkInviteForm.success.imported', { count: bulkInviteSuccess.imported, default: `${bulkInviteSuccess.imported} team members imported` })}</p>
                      {bulkInviteSuccess.emailsSent > 0 && (
                        <p>{t('bulkInviteForm.success.emailsSent', { count: bulkInviteSuccess.emailsSent, default: `${bulkInviteSuccess.emailsSent} invite emails sent` })}</p>
                      )}
                      {bulkInviteSuccess.emailsFailed > 0 && (
                        <p className="text-amber-700">{t('bulkInviteForm.success.emailsFailed', { count: bulkInviteSuccess.emailsFailed, default: `${bulkInviteSuccess.emailsFailed} emails failed to send` })}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowBulkInviteForm(false)
                      setBulkInviteSuccess(null)
                      // Refresh data
                      window.location.reload()
                    }}
                    className="w-full px-6 py-3.5 bg-brand-primary text-white rounded-xl hover:bg-brand-primary-hover font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary shadow-md hover:shadow-lg"
                  >
                    {t('bulkInviteForm.success.done', { default: 'Done' })}
                  </button>
                </div>
              )}

              {/* Upload and Preview State */}
              {!bulkInviteSuccess && (
                <div className="space-y-6">
                  {/* File Upload Zone */}
                  {!bulkInvitePreview && (
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                        bulkInviteFile
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-gray-300 hover:border-brand-primary hover:bg-gray-50'
                      }`}
                      onClick={() => document.getElementById('bulk-invite-file-input')?.click()}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.add('border-brand-primary', 'bg-brand-primary/5')
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        if (!bulkInviteFile) {
                          e.currentTarget.classList.remove('border-brand-primary', 'bg-brand-primary/5')
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const file = e.dataTransfer.files[0]
                        if (file && (file.name.endsWith('.csv') || file.name.endsWith('.zip'))) {
                          setBulkInviteFile(file)
                          setBulkInviteError(null)
                        } else {
                          setBulkInviteError('Please upload a CSV or ZIP file')
                        }
                      }}
                    >
                      <input
                        id="bulk-invite-file-input"
                        type="file"
                        accept=".csv,.zip"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setBulkInviteFile(file)
                            setBulkInviteError(null)
                          }
                        }}
                      />
                      <DocumentArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      {bulkInviteFile ? (
                        <div>
                          <p className="font-semibold text-gray-900">{bulkInviteFile.name}</p>
                          <p className="text-sm text-gray-500 mt-1">{(bulkInviteFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-gray-700">{t('bulkInviteForm.upload.dragDrop', { default: 'Drag and drop or click to upload' })}</p>
                          <p className="text-sm text-gray-500 mt-1">{t('bulkInviteForm.upload.formats', { default: 'CSV or ZIP file (max 5MB)' })}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CSV Format Help */}
                  {!bulkInvitePreview && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('bulkInviteForm.format.title', { default: 'Supported CSV Formats' })}</h4>
                      <p className="text-xs text-gray-600 mb-2">
                        {t('bulkInviteForm.format.description', { default: 'We auto-detect columns from common HR platforms like BambooHR, Workday, Gusto, and more.' })}
                      </p>
                      <div className="text-xs text-gray-500 font-mono bg-white rounded p-2 border border-gray-200">
                        email, first_name, last_name<br />
                        john@company.com, John, Doe<br />
                        jane@company.com, Jane, Smith
                      </div>
                    </div>
                  )}

                  {/* Preview Results */}
                  {bulkInvitePreview && (
                    <div className="space-y-4">
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                          <p className="text-2xl font-bold text-green-700">{bulkInvitePreview.readyToImport}</p>
                          <p className="text-xs text-green-600 font-medium">{t('bulkInviteForm.preview.readyToImport', { default: 'Ready to Import' })}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                          <p className="text-2xl font-bold text-gray-700">{bulkInvitePreview.totalRowsParsed}</p>
                          <p className="text-xs text-gray-600 font-medium">{t('bulkInviteForm.preview.totalRows', { default: 'Total Rows' })}</p>
                        </div>
                      </div>

                      {/* Skipped Info */}
                      {(bulkInvitePreview.duplicatesRemoved > 0 || bulkInvitePreview.existingMembersSkipped > 0) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-sm font-medium text-amber-800 mb-1">{t('bulkInviteForm.preview.skipped', { default: 'Skipped entries:' })}</p>
                          <ul className="text-xs text-amber-700 space-y-1">
                            {bulkInvitePreview.duplicatesRemoved > 0 && (
                              <li>• {bulkInvitePreview.duplicatesRemoved} {t('bulkInviteForm.preview.duplicates', { default: 'duplicate emails' })}</li>
                            )}
                            {bulkInvitePreview.existingMembersSkipped > 0 && (
                              <li>• {bulkInvitePreview.existingMembersSkipped} {t('bulkInviteForm.preview.existing', { default: 'already team members' })}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Seat Check */}
                      {!bulkInvitePreview.hasEnoughSeats && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                          <p className="text-sm font-bold text-red-800 mb-1">{t('bulkInviteForm.preview.noSeats.title', { default: 'Not enough seats' })}</p>
                          <p className="text-sm text-red-700">
                            {t('bulkInviteForm.preview.noSeats.description', {
                              required: bulkInvitePreview.seatsRequired,
                              available: bulkInvitePreview.seatsAvailable,
                              default: `You need ${bulkInvitePreview.seatsRequired} seats but only have ${bulkInvitePreview.seatsAvailable} available.`
                            })}
                          </p>
                          <Link
                            href="/app/seats"
                            className="inline-block mt-3 text-sm font-semibold text-red-700 hover:text-red-800 underline"
                          >
                            {t('bulkInviteForm.preview.noSeats.buyMore', { default: 'Purchase more seats →' })}
                          </Link>
                        </div>
                      )}

                      {/* Preview Table */}
                      {bulkInvitePreview.previewRows.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">{t('bulkInviteForm.preview.sample', { default: 'Sample entries:' })}</p>
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-700">{t('bulkInviteForm.preview.name', { default: 'Name' })}</th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-700">{t('bulkInviteForm.preview.email', { default: 'Email' })}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {bulkInvitePreview.previewRows.map((row, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-2 text-gray-900">{row.firstName}</td>
                                    <td className="px-4 py-2 text-gray-600">{row.email}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {bulkInvitePreview.readyToImport > 5 && (
                              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
                                {t('bulkInviteForm.preview.andMore', { count: bulkInvitePreview.readyToImport - 5, default: `...and ${bulkInvitePreview.readyToImport - 5} more` })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {bulkInvitePreview.warnings.length > 0 && (
                        <details className="text-sm">
                          <summary className="text-amber-700 cursor-pointer font-medium">
                            {t('bulkInviteForm.preview.warnings', { count: bulkInvitePreview.warnings.length, default: `${bulkInvitePreview.warnings.length} warnings` })}
                          </summary>
                          <ul className="mt-2 text-xs text-amber-600 space-y-1 pl-4">
                            {bulkInvitePreview.warnings.map((warning, idx) => (
                              <li key={idx}>• {warning}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Error Display */}
                  {bulkInviteError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-sm text-red-700 font-medium">{bulkInviteError}</p>
                    </div>
                  )}

                  {/* Photo Style Selection (same as single invite) */}
                  {bulkInvitePreview && bulkInvitePreview.hasEnoughSeats && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        {t('inviteForm.photoStyle.label', { default: 'Photo Style' })}
                      </label>
                      {isFreePlan ? (
                        <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="text-sm font-semibold text-gray-900 mb-2">
                            {t('inviteForm.photoStyle.useFreePackageStyle', { default: 'Free Package Style' })}
                          </div>
                          <div className="text-xs text-gray-600 font-medium leading-relaxed">
                            {t('inviteForm.photoStyle.useFreePackageStyleDesc', { default: 'Team members will use the free package photo style.' })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-brand-primary-light to-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4 shadow-sm">
                          <div className="text-sm font-semibold text-brand-primary mb-2">
                            {t('inviteForm.photoStyle.useActiveStyle', { default: 'Active Photo Style' })}
                          </div>
                          <div className="text-xs text-brand-primary/80 font-medium leading-relaxed">
                            {t('bulkInviteForm.styleNote', { name: teamData?.activeContext?.name || 'Active Style', default: `All team members will use: ${teamData?.activeContext?.name || 'Active Style'}` })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* What Happens Next */}
                  {bulkInvitePreview && bulkInvitePreview.hasEnoughSeats && (
                    <div className="bg-gradient-to-br from-brand-primary-light to-brand-primary/5 border-2 border-brand-primary/20 rounded-2xl p-5 shadow-sm">
                      <h4 className="text-sm font-bold text-brand-primary mb-3">{t('inviteForm.whatHappensNext.title')}</h4>
                      <ul className="text-xs text-brand-primary space-y-2 font-medium">
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{t('bulkInviteForm.whatHappensNext.step1', { count: bulkInvitePreview.readyToImport, default: `${bulkInvitePreview.readyToImport} invite emails will be sent` })}</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{t('inviteForm.whatHappensNext.step3')}</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{t('bulkInviteForm.whatHappensNext.step3', { default: 'Each team member gets 10 photos' })}</span>
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    {!bulkInvitePreview ? (
                      // Upload step - Preview button
                      <>
                        <button
                          onClick={async () => {
                            if (!bulkInviteFile) {
                              setBulkInviteError('Please select a file first')
                              return
                            }
                            setBulkInviteLoading(true)
                            setBulkInviteError(null)
                            try {
                              const formData = new FormData()
                              formData.append('file', bulkInviteFile)
                              const response = await fetch('/api/team/invites/bulk', {
                                method: 'POST',
                                body: formData
                              })
                              const data = await response.json()
                              if (!response.ok) {
                                throw new Error(data.error || 'Failed to process file')
                              }
                              setBulkInvitePreview(data.preview)
                              setBulkInviteParsedData(data.parsedData)
                            } catch (err) {
                              setBulkInviteError(err instanceof Error ? err.message : 'Failed to process file')
                            } finally {
                              setBulkInviteLoading(false)
                            }
                          }}
                          disabled={bulkInviteLoading || !bulkInviteFile}
                          className={`flex-1 px-6 py-3.5 rounded-xl font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                            bulkInviteLoading || !bulkInviteFile
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-md hover:shadow-lg'
                          }`}
                        >
                          {bulkInviteLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              {t('bulkInviteForm.buttons.processing', { default: 'Processing...' })}
                            </span>
                          ) : (
                            t('bulkInviteForm.buttons.preview', { default: 'Preview Import' })
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkInviteForm(false)
                            setBulkInviteFile(null)
                            setBulkInviteError(null)
                          }}
                          className="px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                        >
                          {t('bulkInviteForm.buttons.cancel', { default: 'Cancel' })}
                        </button>
                      </>
                    ) : (
                      // Preview step - Import buttons
                      <>
                        {bulkInvitePreview.hasEnoughSeats && bulkInvitePreview.readyToImport > 0 && (
                          <>
                            <button
                              onClick={async () => {
                                if (!bulkInviteParsedData) return
                                setBulkInviteLoading(true)
                                setBulkInviteError(null)
                                try {
                                  const response = await fetch('/api/team/invites/bulk/confirm', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      invites: bulkInviteParsedData,
                                      skipEmail: false
                                    })
                                  })
                                  const data = await response.json()
                                  if (!response.ok) {
                                    throw new Error(data.error || 'Failed to import')
                                  }
                                  setBulkInviteSuccess({
                                    imported: data.imported,
                                    emailsSent: data.emailsSent,
                                    emailsFailed: data.emailsFailed
                                  })
                                  refetchCredits()
                                } catch (err) {
                                  setBulkInviteError(err instanceof Error ? err.message : 'Failed to import')
                                } finally {
                                  setBulkInviteLoading(false)
                                }
                              }}
                              disabled={bulkInviteLoading}
                              className={`flex-1 px-6 py-3.5 rounded-xl font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                                bulkInviteLoading
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-md hover:shadow-lg'
                              }`}
                            >
                              {bulkInviteLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  {t('bulkInviteForm.buttons.importing', { default: 'Importing...' })}
                                </span>
                              ) : (
                                <>
                                  <EnvelopeIcon className="h-5 w-5 inline mr-2" />
                                  {t('bulkInviteForm.buttons.sendInvites', { count: bulkInvitePreview.readyToImport, default: `Send ${bulkInvitePreview.readyToImport} Invites` })}
                                </>
                              )}
                            </button>
                            <button
                              onClick={async () => {
                                if (!bulkInviteParsedData) return
                                setBulkInviteLoading(true)
                                setBulkInviteError(null)
                                try {
                                  const response = await fetch('/api/team/invites/bulk/confirm', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      invites: bulkInviteParsedData,
                                      skipEmail: true
                                    })
                                  })
                                  const data = await response.json()
                                  if (!response.ok) {
                                    throw new Error(data.error || 'Failed to import')
                                  }
                                  setBulkInviteSuccess({
                                    imported: data.imported,
                                    emailsSent: 0,
                                    emailsFailed: 0
                                  })
                                  refetchCredits()
                                } catch (err) {
                                  setBulkInviteError(err instanceof Error ? err.message : 'Failed to import')
                                } finally {
                                  setBulkInviteLoading(false)
                                }
                              }}
                              disabled={bulkInviteLoading}
                              className={`px-6 py-3.5 rounded-xl font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary border-2 ${
                                bulkInviteLoading
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-white text-brand-secondary border-brand-secondary hover:bg-brand-secondary/5'
                              }`}
                            >
                              {t('bulkInviteForm.buttons.createLinks', { default: 'Create Links Only' })}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setBulkInvitePreview(null)
                            setBulkInviteParsedData(null)
                            setBulkInviteFile(null)
                          }}
                          disabled={bulkInviteLoading}
                          className="px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                        >
                          {t('bulkInviteForm.buttons.back', { default: 'Back' })}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Photos Modal */}
      {addPhotosInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[110] overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full my-4 shadow-2xl animate-scale-in border border-gray-200">
            <div className="p-6 sm:p-7">
              <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
                {t('addPhotosModal.title', { name: addPhotosInvite.firstName || addPhotosInvite.email })}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {t('addPhotosModal.currentAllocation', { count: calculatePhotosFromCredits(addPhotosInvite.creditsAllocated) })}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('addPhotosModal.photosToAdd')}
                </label>
                <input
                  type="number"
                  min="1"
                  max={Math.floor(credits.team / PRICING_CONFIG.credits.perGeneration)}
                  value={addPhotosValue}
                  onChange={(e) => {
                    const value = e.target.value
                    setAddPhotosValue(value)
                    
                    // Validate and show appropriate error
                    const numValue = parseInt(value)
                    const availablePhotos = Math.floor(credits.team / PRICING_CONFIG.credits.perGeneration)
                    
                    if (!value || isNaN(numValue) || numValue < 1) {
                      setAddPhotosError(t('addPhotosModal.invalidAmount'))
                    } else if (numValue > availablePhotos) {
                      setAddPhotosError(t('addPhotosModal.insufficientCredits', { available: availablePhotos.toString() }))
                    } else {
                      setAddPhotosError(null)
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {t('addPhotosModal.availableTeamPhotos', { count: calculatePhotosFromCredits(credits.team) })}
                </p>
              </div>

              {addPhotosError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-sm text-red-700 font-medium">{addPhotosError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddPhotos}
                  disabled={addingPhotos || !addPhotosValue || parseInt(addPhotosValue) < 1 || parseInt(addPhotosValue) * PRICING_CONFIG.credits.perGeneration > credits.team}
                  className={`flex-1 px-5 py-3 rounded-xl font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${
                    addingPhotos || !addPhotosValue || parseInt(addPhotosValue) < 1 || parseInt(addPhotosValue) * PRICING_CONFIG.credits.perGeneration > credits.team
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-md hover:shadow-lg'
                  }`}
                >
                  {addingPhotos ? t('addPhotosModal.adding') : t('addPhotosModal.addButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddPhotosInvite(null)
                    setAddPhotosValue('1')
                    setAddPhotosError(null)
                  }}
                  className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                >
                  {t('addPhotosModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile - Bottom Sticky Invite Button - Show for admins with active context, free plan, OR seats-based teams */}
      {userRoles.isTeamAdmin && (teamData?.activeContext || isFreePlan || teamData?.seatInfo?.isSeatsModel) && (
        <>
          {/* Mobile - Bottom Sticky Button */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm pt-3 pb-3 px-4 border-t border-gray-100 shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.08)]">
            {isFreePlan ? (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                <PlusIcon className="h-4.5 w-4.5" />
                {t('buttons.upgradeToInvite')}
              </button>
            ) : !teamData?.activeContext && teamData?.seatInfo?.isSeatsModel ? (
              // Seats-based team without photo style - prompt to set up first
              <Link
                href="/app/styles/team/create"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg bg-gradient-to-r from-brand-primary to-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                <PlusIcon className="h-4.5 w-4.5" />
                {t('setupRequired.createButton')}
              </Link>
            ) : credits.team === 0 ? (
              <Link
                href="/app/top-up"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${BRAND_CONFIG.colors.cta}, ${BRAND_CONFIG.colors.ctaHover})`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${BRAND_CONFIG.colors.ctaHover}, #4F46E5)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${BRAND_CONFIG.colors.cta}, ${BRAND_CONFIG.colors.ctaHover})`
                }}
              >
                <PlusIcon className="h-4.5 w-4.5" />
                {t('buttons.buyCredits')}
              </Link>
            ) : (
              <button
                id="floating-invite-btn-mobile"
                onClick={() => {
                  setInviteError(null)
                  setError(null)
                  setEmailValue('')
                  setFirstNameValue('')
                  setShowInviteForm(true)
                }}
                className="group w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg bg-gradient-to-r from-brand-secondary to-brand-secondary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary"
              >
                <PlusIcon className="h-4.5 w-4.5 transition-transform group-hover:rotate-90 duration-200" />
                {t('buttons.inviteTeamMember')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}