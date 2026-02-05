'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/routing'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { jsonFetcher } from '@/lib/fetcher'
import { getCleanClientBaseUrl } from '@/lib/url'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import {
  HomeIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  PaintBrushIcon,
  UserIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon,
  PhotoIcon,
  UserGroupIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import { BRAND_CONFIG } from '@/config/brand'
import { normalizePlanTierForUI, isFreePlan, type PlanPeriod, type UIPlanTier } from '@/domain/subscription/utils'
import { AccountMode, fetchAccountMode } from '@/domain/account/accountMode'
import { SubscriptionInfo } from '@/domain/subscription/subscription'

// Serialized subscription type for client-side (Date objects are ISO strings)
type SerializedSubscription = Omit<SubscriptionInfo, 'nextRenewal' | 'nextChange'> & {
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: Exclude<SubscriptionInfo['tier'], null>
    planPeriod: Exclude<SubscriptionInfo['period'], null>
    effectiveDate: string
  } | null
}
import { 
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  PaintBrushIcon as PaintBrushIconSolid,
  UserIcon as UserIconSolid,
  CameraIcon as CameraIconSolid,
  PhotoIcon as PhotoIconSolid,
} from '@heroicons/react/24/solid'

type TeamOnboardingStep = 'team_setup' | 'style_setup' | 'invite_members'

/**
 * Map UIPlanTier to the simplified state type used in the sidebar
 */
function mapUITierToStateTier(uiTier: UIPlanTier): 'free' | 'individual' | 'pro' {
  switch (uiTier) {
    case 'free':
      return 'free'
    case 'individual':
      return 'individual'
    case 'vip':
      return 'individual' // VIP is still individual tier, just large period
    case 'team':
      return 'pro' // Team/seats plans are pro tier
    default:
      return 'free'
  }
}

interface SidebarRoleState {
  isTeamAdmin: boolean
  isTeamMember: boolean
  needsTeamSetup: boolean
  needsPhotoStyleSetup?: boolean
  needsTeamInvites?: boolean
  nextTeamOnboardingStep?: TeamOnboardingStep | null
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconSolid: React.ComponentType<{ className?: string }>
  current: boolean
  showFor: string[]
  id?: string
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onMenuItemClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  initialRole?: SidebarRoleState
  initialAccountMode?: AccountMode
  initialSubscription?: SerializedSubscription | null
  initialBrandName?: string
  initialBrandLogoLight?: string
  initialBrandLogoIcon?: string
  /** If true, hide team-related menu items (for individual-only domains like portreya.com) */
  isIndividualDomain?: boolean
}

export default function Sidebar({ collapsed, onToggle, onMenuItemClick, onMouseEnter, onMouseLeave, initialRole, initialAccountMode, initialSubscription, initialBrandName, initialBrandLogoLight, initialBrandLogoIcon, isIndividualDomain = false }: SidebarProps) {
  // Brand-aware border color
  const sidebarBorderClass = isIndividualDomain ? 'border-[#0F172A]/8' : 'border-gray-200/60'
  const { data: session } = useSession()
  const pathname = usePathname()
  const t = useTranslations('app.sidebar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(initialRole?.isTeamMember ?? false)
  const [isTeamAdmin, setIsTeamAdmin] = useState(initialRole?.isTeamAdmin ?? false)
  
  // Use server-provided brand values to avoid hydration mismatch
  const brandName = initialBrandName ?? BRAND_CONFIG.name
  const brandLogoLight = initialBrandLogoLight ?? BRAND_CONFIG.logo.light
  const brandLogoIcon = initialBrandLogoIcon ?? BRAND_CONFIG.logo.icon
  const [needsTeamSetup, setNeedsTeamSetup] = useState(initialRole?.needsTeamSetup ?? false)
  const [, setNeedsPhotoStyleSetup] = useState(initialRole?.needsPhotoStyleSetup ?? false)
  const [, setNeedsTeamInvites] = useState(initialRole?.needsTeamInvites ?? false)
  const [, setNextTeamOnboardingStep] = useState<TeamOnboardingStep | null>(initialRole?.nextTeamOnboardingStep ?? null)
  const [allocatedCredits, setAllocatedCredits] = useState(0)
  const [accountMode, setAccountMode] = useState<AccountMode>(initialAccountMode ?? 'individual')
  const [navReady, setNavReady] = useState(Boolean(initialRole))
  const [planTier, setPlanTier] = useState<'free' | 'individual' | 'pro' | null>(null)
  const [planLabel, setPlanLabel] = useState<string | null>(null)
  const [seatInfo, setSeatInfo] = useState<{
    totalSeats: number
    activeSeats: number
    availableSeats: number
    isSeatsModel: boolean
  } | null>(null)
  const { credits } = useCredits()
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size for responsive behavior.
  // This is an intentional client-only pattern - window.innerWidth is not available during SSR.
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  // Mobile drawer pattern: when sidebar is open (collapsed=false), show full content
  // Desktop: collapsed prop controls both visibility and styling
  // On mobile when hidden (collapsed=true), sidebar is off-screen
  // FIXED: Previously always used collapsed mode on mobile, now respects open state
  const effectiveCollapsed = collapsed

  // Initialize subscription data from props if available
  useEffect(() => {
    if (initialSubscription) {
      const tierRaw = initialSubscription.tier ?? null
      const period = (initialSubscription.period as PlanPeriod) ?? null

      // Normalize tier for UI (checks period first to determine free plan)
      const normalized = normalizePlanTierForUI(tierRaw, period)
      setPlanTier(mapUITierToStateTier(normalized))

      // Compute human-readable label based on tier+period (transactional pricing)
      // On individual domains, always show individual-style labels (never "Team")
      let label = 'Free package'
      if (isFreePlan(period)) {
        label = t('plan.free')
      } else if (tierRaw === 'individual' && period === 'small') {
        label = 'Individual'
      } else if (tierRaw === 'pro' && period === 'seats') {
        label = isIndividualDomain ? 'Individual' : 'Team'
      } else {
        // Backward compatibility: handle legacy values
        if (tierRaw === 'individual') label = 'Individual'
        else if (tierRaw === 'pro') label = isIndividualDomain ? 'Individual' : 'Pro'
      }
      setPlanLabel(label)
    }
  }, [initialSubscription, isIndividualDomain, t])

  // OPTIMIZATION: Only fetch account mode and team data if not provided as props
  // This eliminates redundant queries when data is already available from server
  useEffect(() => {
    const loadAccountData = async () => {
      if (!session?.user?.id) return

      // If we already have initial data, skip fetching (but still mark as ready)
      if (initialRole && initialAccountMode) {
        // Use initial data directly
        setIsTeamMember(initialRole.isTeamMember)
        setIsTeamAdmin(initialRole.isTeamAdmin)
        setNeedsTeamSetup(initialRole.needsTeamSetup)
        setNeedsPhotoStyleSetup(initialRole.needsPhotoStyleSetup ?? false)
        setNeedsTeamInvites(initialRole.needsTeamInvites ?? false)
        setNextTeamOnboardingStep(initialRole.nextTeamOnboardingStep ?? null)
        setAccountMode(initialAccountMode)
        setNavReady(true)
        return
      }

      // OPTIMIZATION: Check sessionStorage for initial data first
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData.roles && initialData.onboarding) {
            setIsTeamMember(initialData.roles.isTeamMember || false)
            setIsTeamAdmin(initialData.roles.isTeamAdmin || false)
            setNeedsTeamSetup(initialData.onboarding.needsTeamSetup || false)
            setNeedsPhotoStyleSetup(initialData.onboarding.needsPhotoStyleSetup || false)
            setNeedsTeamInvites(initialData.onboarding.needsTeamInvites || false)
            setNextTeamOnboardingStep(initialData.onboarding.nextTeamOnboardingStep ?? null)
            setAccountMode(initialData.onboarding.accountMode || 'individual')
            setNavReady(true)
            return
          }
        }
      } catch {
        // Ignore parse errors, fall through to fetch
      }

      // Fallback: Only fetch if initial data is missing (should rarely happen)
      try {
        // Fetch account mode and team membership in parallel
        const [accountModeResult, teamData] = await Promise.all([
          fetchAccountMode(),
          jsonFetcher<{ userRole: { isTeamMember?: boolean; isTeamAdmin?: boolean; needsTeamSetup?: boolean; needsPhotoStyleSetup?: boolean; needsTeamInvites?: boolean; nextTeamOnboardingStep?: TeamOnboardingStep | null } }>('/api/dashboard/stats').catch(() => null)
        ])

        // Update account mode from centralized utility
        if (accountModeResult.mode) {
          setAccountMode(accountModeResult.mode)
        }

        // Update team membership data
        if (teamData) {
          setIsTeamMember(teamData.userRole.isTeamMember || teamData.userRole.isTeamAdmin || false)
          setIsTeamAdmin(teamData.userRole.isTeamAdmin || false)
          setNeedsTeamSetup(teamData.userRole.needsTeamSetup || false)
          setNeedsPhotoStyleSetup(teamData.userRole.needsPhotoStyleSetup || false)
          setNeedsTeamInvites(teamData.userRole.needsTeamInvites || false)
          setNextTeamOnboardingStep(teamData.userRole.nextTeamOnboardingStep ?? null)
        } else if (session?.user?.role) {
          // Fallback: Use session role, but note this doesn't account for pro subscription
          const role = session.user.role
          setIsTeamAdmin(role === 'team_admin')
          setIsTeamMember(role === 'team_member')
        }

        setNavReady(true)
      } catch (err) {
        console.error('Failed to fetch account data:', err)
        setNavReady(true)
      }
    }

    if (session?.user?.id) {
      loadAccountData()
    }
  }, [session?.user?.id, session?.user?.role, initialRole, initialAccountMode])

  // Fetch allocated credits and seat info for team admins - intentional data fetching on state change
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!isTeamAdmin) return
      try {
        const [creditsData, membersData] = await Promise.all([
          jsonFetcher<{ totalAllocatedCredits: number; totalRemainingCredits: number }>('/api/team/invites/credits'),
          jsonFetcher<{ 
            users: unknown[]
            seatInfo?: {
              totalSeats: number
              activeSeats: number
              availableSeats: number
              isSeatsModel: boolean
            } | null
          }>('/api/team/members')
        ])
        // Show remaining credits across all invites (allocated minus used)
        setAllocatedCredits(creditsData.totalRemainingCredits ?? 0)
        // Store seat info if available
        setSeatInfo(membersData.seatInfo || null)
      } catch (err) {
        setAllocatedCredits(0)
        setSeatInfo(null)
        console.error('Failed to fetch team data:', err)
      }
    }

    // Fetch team data if user is a team admin (regardless of team setup status)
    // Seat info and credit allocation are independent of onboarding state
    if (session?.user?.id && isTeamAdmin) {
      void fetchTeamData()
    } else {
      setAllocatedCredits(0)
      setSeatInfo(null)
    }
  }, [session?.user?.id, isTeamAdmin])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */


  // OPTIMIZATION: Only fetch subscription if not provided as prop
  // This eliminates redundant query when subscription is already available from server
  useEffect(() => {
    // Skip fetching if we already have subscription data from props
    if (initialSubscription) {
      return
    }

    const fetchSubscription = async () => {
      // OPTIMIZATION: Check sessionStorage for initial data first
      try {
        const stored = sessionStorage.getItem('teamshots.initialData')
        if (stored) {
          const initialData = JSON.parse(stored)
          if (initialData.subscription) {
            const tierRaw = initialData.subscription.tier ?? null
            const period = initialData.subscription.period ?? null

            // Normalize tier for UI (checks period first to determine free plan)
            const normalized = normalizePlanTierForUI(tierRaw, period)
            setPlanTier(mapUITierToStateTier(normalized))

            // Compute human-readable label based on tier+period (transactional pricing)
            let label = 'Free package'
            if (isFreePlan(period)) {
              label = t('plan.free')
            } else if (tierRaw === 'individual' && period === 'small') {
              label = 'Individual'
            } else if (tierRaw === 'pro' && period === 'small') {
              label = 'Pro Small'
            } else if (tierRaw === 'pro' && period === 'large') {
              label = 'Pro Large'
            } else if (tierRaw === 'pro' && period === 'seats') {
              label = isIndividualDomain ? 'Individual' : 'Team'
      } else {
        // Backward compatibility: handle legacy values
        if (tierRaw === 'individual') label = 'Individual'
        else if (tierRaw === 'pro') label = 'Pro'
      }
            setPlanLabel(label)

            // Only fetch fresh data if stale (>5 seconds)
            const dataAge = Date.now() - (initialData._timestamp || 0)
            if (dataAge > 5000) {
              // Fetch fresh data in background
              jsonFetcher<{ subscription: { tier: string | null; period?: PlanPeriod } | null }>('/api/user/subscription')
                .then(data => {
                  const freshTier = data?.subscription?.tier ?? null
                  const freshPeriod = data?.subscription?.period ?? null
                  const normalized = normalizePlanTierForUI(freshTier, freshPeriod)
                  setPlanTier(mapUITierToStateTier(normalized))
                  // Update label if needed
                  let label = 'Free package'
                  if (isFreePlan(freshPeriod)) {
                    label = 'Free package'
                  } else if (freshTier === 'individual' && freshPeriod === 'small') {
                    label = 'Individual'
                  } else if (freshTier === 'individual' && freshPeriod === 'large') {
                    label = 'VIP'
                  } else if (freshTier === 'pro' && freshPeriod === 'seats') {
                    label = 'Pro'
                  }
                  setPlanLabel(label)
                })
                .catch(() => {
                  // Ignore errors, keep cached data
                })
            }
            return
          }
        }
      } catch {
        // Ignore parse errors, fall through to fetch
      }

      try {
        const data = await jsonFetcher<{ subscription: { tier: string | null; period?: PlanPeriod } | null }>('/api/user/subscription')
        const tierRaw = data?.subscription?.tier ?? null
        const period = data?.subscription?.period ?? null

        // Normalize tier for UI (checks period first to determine free plan)
        const normalized = normalizePlanTierForUI(tierRaw, period)
        setPlanTier(mapUITierToStateTier(normalized))

        // Compute human-readable label based on tier (transactional pricing)
        let label = 'Free package'
        if (isFreePlan(period)) {
          label = 'Free package'
        } else if (tierRaw === 'individual') {
          label = 'Individual'
        } else if (tierRaw === 'pro') {
          label = 'Pro'
        }
        setPlanLabel(label)
      } catch {
        setPlanTier('free')
        setPlanLabel('Free package')
      }
    }
    if (session?.user?.id) fetchSubscription()
  }, [session?.user?.id, initialSubscription])

  const allNavigation: NavigationItem[] = [
    {
      name: t('nav.dashboard'),
      href: '/app/dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      current: pathname === '/dashboard' || pathname === '/app/dashboard',
      showFor: ['user', 'team_member', 'team_admin'],
    },
    {
      name: t('nav.selfies'),
      href: '/app/selfies',
      icon: CameraIcon,
      iconSolid: CameraIconSolid,
      current: pathname === '/app/selfies',
      showFor: ['user', 'team_member', 'team_admin'],
    },
    {
      name: t('nav.personalPhotoStyles'),
      href: '/app/styles/personal',
      icon: PaintBrushIcon,
      iconSolid: PaintBrushIconSolid,
      current: pathname === '/app/styles/personal',
      showFor: ['user', 'team_member', 'team_admin'],
      id: 'sidebar-personal-styles-nav',
    },
    {
      name: t('nav.personalGenerations'),
      href: '/app/generations/personal',
      icon: UserIcon,
      iconSolid: UserIconSolid,
      current: pathname === '/app/generations/personal',
      showFor: ['user', 'team_member', 'team_admin'],
    },
    {
      name: t('nav.teamGenerations'),
      href: '/app/generations/team',
      icon: PhotoIcon,
      iconSolid: PhotoIconSolid,
      current: pathname === '/app/generations/team',
      showFor: ['team_member', 'team_admin'],
    },
    {
      name: t('nav.teamPhotoStyles'),
      href: '/app/styles/team',
      icon: PaintBrushIcon,
      iconSolid: PaintBrushIconSolid,
      current: pathname === '/app/styles/team',
      showFor: ['team_admin', 'team_member'], // Pro users will have effective role 'team_member'
      id: 'sidebar-team-styles-nav',
    },
    {
      name: t('nav.team'),
      href: '/app/team',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      current: pathname === '/team' || pathname === '/app/team',
      showFor: ['team_admin', 'team_member'], // Pro users will have effective role 'team_member'
      id: 'sidebar-team-nav',
    },
  ]

  // Determine effective role for navigation filtering
  // Pro users are team admins by definition, so they get team_admin role
  const getUserRole = () => {
    if (isTeamAdmin) {
      return 'team_admin'
    } else if (accountMode === 'pro') {
      // Pro users are team admins by definition, even if not yet in a team
      return 'team_admin'
    } else if (isTeamMember) {
      return 'team_member'
    } else {
      return 'user'
    }
  }

  const userRole = getUserRole()

  // Filter navigation based on user role
  const roleFiltered = allNavigation.filter(item => item.showFor.includes(userRole))

  // Further filter by selected account mode
  const individualHrefs = new Set([
    '/app/dashboard',
    '/app/selfies',
    '/app/styles/personal',
    '/app/generations/personal',
  ])
  const proHrefs = new Set([
    '/app/dashboard',
    '/app/selfies',
    '/app/generations/team',
    '/app/styles/team',
    '/app/team',
  ])

  // Filter navigation based on account mode
  // Pro mode: show pro/team features (unless on individual-only domain)
  // Individual mode: show personal features
  // Team members (invited) don't have sidebar (handled separately)
  // On individual-only domains (portreya.com), always show personal navigation, never team
  let navigation: NavigationItem[]
  if (isIndividualDomain) {
    // Individual domain: always show personal navigation, regardless of account mode
    navigation = roleFiltered.filter(item => individualHrefs.has(item.href))
  } else if (accountMode === 'pro') {
    // Pro mode on team domain: show pro/team features
    navigation = roleFiltered.filter(item => proHrefs.has(item.href))
  } else if (accountMode === 'individual') {
    // Individual mode: show personal features
    navigation = roleFiltered.filter(item => individualHrefs.has(item.href))
  } else {
    // team_member mode - no sidebar navigation
    navigation = []
  }

  const handleSignOut = async () => {
    try {
      // SECURITY: Revoke the JWT token before signing out
      // This ensures the token cannot be used after logout
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      // Log error but continue with signOut to ensure cookie is cleared
      console.error('Failed to revoke token on logout:', error)
    }

    // Use clean base URL to avoid :80 port from reverse proxy headers
    const callbackUrl = `${getCleanClientBaseUrl()}/`
    signOut({ callbackUrl })
  }

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[120] text-[var(--text-dark)] bg-[var(--bg-white)] border-r ${sidebarBorderClass} transition-all duration-300 transform shadow-sm ${
        // Width: w-72 on mobile when open (drawer), w-64 on desktop when expanded, w-20 when collapsed
        (isMobile ? (collapsed ? 'w-20' : 'w-72') : (effectiveCollapsed ? 'w-20' : 'w-64')) + ' ' +
        // Visibility: use collapsed prop (when false, sidebar is visible)
        (collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0') + ' ' +
        // Overflow: only visible on desktop collapsed mode (for tooltips), hidden on mobile to prevent content bleeding
        (!isMobile && effectiveCollapsed ? 'overflow-visible' : 'overflow-hidden')
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`flex flex-col h-dvh max-h-screen ${!isMobile && effectiveCollapsed ? 'overflow-visible' : 'overflow-hidden'}`}>
        {/* Top Section - Header and Primary Action */}
        <div className="flex-shrink-0">
          {/* Header */}
          <div className="h-24 flex items-start justify-between px-3 py-4">
            {/* Logo container - fixed dimensions, content switches with crossfade */}
            <Link href="/" className="flex items-center h-10 min-w-[40px] relative">
              {/* Icon logo - always rendered, fades in when collapsed */}
              <div className={`flex items-center justify-center transition-opacity duration-300 ${
                effectiveCollapsed ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}>
                <Image src={brandLogoIcon} alt={brandName} width={40} height={40} className="h-10 w-10" priority />
              </div>
              {/* Full logo - always rendered, fades in when expanded */}
              <div className={`flex items-center transition-opacity duration-300 ${
                effectiveCollapsed ? 'opacity-0 absolute pointer-events-none' : 'opacity-100'
              }`}>
                <Image src={brandLogoLight} alt={brandName} width={112} height={28} className="h-7" style={{ width: 'auto' }} priority />
              </div>
            </Link>
            {/* Toggle button - only visible on mobile (desktop uses hover to expand/collapse) */}
            <div className={`relative group flex-shrink-0 ${isMobile ? '' : 'hidden'}`}>
              <button
                onClick={onToggle}
                aria-label={collapsed ? 'Show menu' : 'Hide sidebar'}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                {/* On mobile: show hamburger when hidden, X when visible */}
                {collapsed ? (
                  <Bars3Icon className="h-5 w-5 text-gray-500" />
                ) : (
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                )}
                {/* Desktop chevrons - hidden but kept for potential future use */}
                {/*
                {effectiveCollapsed ? (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronLeftIcon className="h-5 w-5 text-gray-500" />
                )}
                */}
              </button>
              <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
              }`}>
                {collapsed ? 'Show menu' : 'Hide sidebar'}
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="px-3 pb-4 pt-3 relative group">
            <Link
              id="primary-generate-btn"
              href="/app/generate/start"
              onClick={onMenuItemClick}
              className="flex items-center bg-brand-cta text-white rounded-xl px-3 py-3 font-medium hover:bg-brand-cta-hover transition-all duration-300 min-h-[44px]"
            >
              <span className="flex-shrink-0 w-5 flex items-center justify-center">
                <PlusIcon className="h-5 w-5" />
              </span>
              <span 
                className={`text-sm whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                  effectiveCollapsed 
                    ? 'w-0 opacity-0 ml-0' 
                    : 'w-auto opacity-100 ml-2'
                }`}
              >
                {t('primary.generate')}
              </span>
            </Link>
            <span 
              className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                effectiveCollapsed 
                  ? 'opacity-0 group-hover:opacity-100' 
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              {t('primary.generate')}
            </span>
          </div>
        </div>

        {/* Navigation - Takes up available space */}
        <nav className={`flex-1 px-3 py-4 min-h-0 bg-[var(--bg-white)] ${!isMobile && effectiveCollapsed ? 'overflow-visible' : 'overflow-y-auto'} overscroll-contain`} style={{ touchAction: 'pan-y' }}>
          <div className={`h-full space-y-2 ${effectiveCollapsed ? '' : 'overflow-x-visible'}`}>
            {!navReady ? null : navigation.map((item) => {
              const Icon = item.current ? item.iconSolid : item.icon
              return (
                <div key={item.name} className="group relative overflow-visible">
                  <Link
                    href={item.href}
                    id={item.id}
                    onClick={onMenuItemClick}
                    className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-1 ${
                      item.current
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                    }`}
                  >
                    {/* Icon - fixed width, no margin change to prevent shifting */}
                    <span className="flex-shrink-0 w-5 flex items-center justify-center">
                      <Icon className={`h-5 w-5 transition-colors duration-200 ${
                        item.current ? 'text-brand-primary' : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                    </span>
                    {/* Text - transitions opacity and width smoothly */}
                    <span 
                      className={`leading-relaxed whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                        effectiveCollapsed 
                          ? 'w-0 opacity-0 ml-0' 
                          : 'w-auto opacity-100 ml-3'
                      }`}
                    >
                      {item.name}
                    </span>
                  </Link>
                  {/* Tooltip - only shows on hover when collapsed */}
                  <span 
                    className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[10000] shadow-lg ${
                      effectiveCollapsed 
                        ? 'opacity-0 group-hover:opacity-100' 
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
              )
            })}
          </div>
        </nav>

        {/* Bottom Section - Credits and User Profile (Fixed at bottom) */}
        <div className={`flex-shrink-0 ${!isMobile && effectiveCollapsed ? 'overflow-visible' : ''}`}>
          {/* Credits Card Section */}
          {session?.user && (
            <div className="px-3 pb-3">
              {/* Credits Card - wraps plan badge, credits display, and upgrade button */}
              <div className={`bg-gray-50/80 rounded-2xl border border-gray-200/60 transition-all duration-300 ${effectiveCollapsed ? 'p-2' : 'p-4'}`}>
                {/* Plan badge - fades in/out smoothly */}
                {planTier && (
                  <div 
                    className={`flex items-center justify-between transition-all duration-300 overflow-hidden ${
                      effectiveCollapsed 
                        ? 'h-0 opacity-0 mb-0' 
                        : 'h-auto opacity-100 mb-3'
                    }`}
                  >
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        planTier === 'pro'
                          ? 'bg-brand-premium/10 text-brand-premium'
                          : planTier === 'individual'
                          ? (isIndividualDomain ? 'bg-[#B45309]/10 text-[#B45309]' : 'bg-brand-primary/10 text-brand-primary')
                          : 'bg-gray-200/80 text-gray-600'
                      }`}
                    >
                      {planLabel ?? ''}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                {/* On individual domains, always show individual credits regardless of account mode */}
                {(accountMode === 'individual' || isIndividualDomain) && (
                  <div className="relative group">
                    {/* Unified structure with crossfade between layouts */}
                    <div className="relative min-h-[44px]">
                      {/* Collapsed view: icon above number - fades in when collapsed */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        <CreditCardIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-bold mt-0.5 text-gray-900">
                          {calculatePhotosFromCredits(credits.individual ?? 0)}
                        </span>
                      </div>
                      {/* Expanded view: label + number - fades in when expanded */}
                      <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}>
                        <span className="text-sm text-gray-600">
                          {t('photos.individual')}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {calculatePhotosFromCredits(credits.individual ?? 0)}
                        </span>
                      </div>
                    </div>
                    {/* Tooltip */}
                    <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                      effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      {t('photos.individual')}: {calculatePhotosFromCredits(credits.individual ?? 0)}
                    </span>
                  </div>
                )}

                {/* Free-plan team admin: Show personal credits (no seats purchased yet) — hidden on individual domains */}
                {!isIndividualDomain && accountMode === 'pro' && (!seatInfo || seatInfo.totalSeats === 0) && (
                  <div className="relative group">
                    <div className="relative min-h-[44px]">
                      {/* Collapsed view */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        <CreditCardIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-bold mt-0.5 text-gray-900">
                          {calculatePhotosFromCredits(credits.person ?? 0)}
                        </span>
                      </div>
                      {/* Expanded view */}
                      <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}>
                        <span className="text-sm text-gray-600">
                          {t('photos.individual')}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {calculatePhotosFromCredits(credits.person ?? 0)}
                        </span>
                      </div>
                    </div>
                    {/* Tooltip */}
                    <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                      effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      {t('photos.individual')}: {calculatePhotosFromCredits(credits.person ?? 0)}
                    </span>
                  </div>
                )}

                {/* Paid team admin: Show seats + person balance — hidden on individual domains */}
                {!isIndividualDomain && accountMode === 'pro' && seatInfo && seatInfo.totalSeats > 0 && (
                  <div className="relative group space-y-1">
                    {/* Seats row */}
                    <div className="relative min-h-[44px]">
                      {/* Collapsed view */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        <UserGroupIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-bold mt-0.5 text-gray-900">
                          {seatInfo.activeSeats}/{seatInfo.totalSeats}
                        </span>
                      </div>
                      {/* Expanded view */}
                      <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}>
                        <span className="text-sm text-gray-600">
                          {t('photos.seats')}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {seatInfo.activeSeats} / {seatInfo.totalSeats}
                        </span>
                      </div>
                    </div>
                    {/* Photo balance row */}
                    <div className="relative min-h-[44px]">
                      {/* Collapsed view */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        <CreditCardIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-bold mt-0.5 text-gray-900">
                          {calculatePhotosFromCredits(credits.person ?? 0)}
                        </span>
                      </div>
                      {/* Expanded view */}
                      <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                        effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}>
                        <span className="text-sm text-gray-600">
                          {t('photos.balance')}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {calculatePhotosFromCredits(credits.person ?? 0)}
                        </span>
                      </div>
                    </div>
                    {/* Tooltip */}
                    <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                      effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      {t('photos.seats')}: {seatInfo.activeSeats} / {seatInfo.totalSeats}
                      <br />
                      {t('photos.balance')}: {calculatePhotosFromCredits(credits.person ?? 0)}
                    </span>
                  </div>
                )}

                {/* Legacy credit-based Pro teams: Show team credits — hidden on individual domains */}
                {!isIndividualDomain && seatInfo && !seatInfo.isSeatsModel && seatInfo.totalSeats > 0 && (
                  <>
                    <div className="relative group">
                      <div className="relative min-h-[44px]">
                        {/* Collapsed view */}
                        <div className={`absolute inset-0 flex flex-col items-center justify-center py-1 transition-opacity duration-300 ${
                          effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}>
                          <UserGroupIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-bold mt-0.5 text-gray-900">
                            {calculatePhotosFromCredits(credits.team ?? 0)}
                          </span>
                        </div>
                        {/* Expanded view */}
                        <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                          effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}>
                          <span className="text-sm text-gray-600">
                            {t('photos.team')}
                          </span>
                          <span className="text-lg font-bold text-gray-900">
                            {calculatePhotosFromCredits(credits.team ?? 0)}
                          </span>
                        </div>
                      </div>
                      {/* Tooltip */}
                      <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                        effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                      }`}>
                        {t('photos.team')}: {calculatePhotosFromCredits(credits.team ?? 0)}
                      </span>
                    </div>
                    {isTeamAdmin && allocatedCredits > 0 && (
                      <div className="relative group">
                        <div className="relative min-h-[44px]">
                          {/* Collapsed view */}
                          <div className={`absolute inset-0 flex flex-col items-center justify-center py-1 transition-opacity duration-300 ${
                            effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                          }`}>
                            <CreditCardIcon className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-bold mt-0.5 text-brand-cta">
                              {calculatePhotosFromCredits(allocatedCredits)}
                            </span>
                          </div>
                          {/* Expanded view */}
                          <div className={`flex items-center justify-between py-1 transition-opacity duration-300 ${
                            effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                          }`}>
                            <span className="text-sm text-gray-600">
                              {t('photos.allocated')}
                            </span>
                            <span className="text-lg font-bold text-brand-cta">
                              {calculatePhotosFromCredits(allocatedCredits)}
                            </span>
                          </div>
                        </div>
                        {/* Tooltip */}
                        <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                          effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                        }`}>
                          {t('photos.allocated')}: {calculatePhotosFromCredits(allocatedCredits)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {/* Don't render sidebar for team_member mode (invited members) */}
                {accountMode === 'team_member' && null}
              </div>

                {/* Buy Credits Button - unified structure */}
                <div className="mt-3 relative group">
                  <Link
                    href={
                      planTier === 'free' ? '/app/upgrade' :
                      planTier === 'pro' && accountMode === 'pro' ? '/app/upgrade' :
                      '/app/top-up'
                    }
                    onClick={onMenuItemClick}
                    className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white rounded-xl transition-all duration-300 bg-brand-cta hover:bg-brand-cta-hover min-h-[40px]"
                  >
                    <PlusIcon className="h-4 w-4 flex-shrink-0" />
                    <span
                      className={`whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${
                        effectiveCollapsed
                          ? 'w-0 opacity-0 ml-0'
                          : 'w-auto opacity-100 ml-1.5'
                      }`}
                    >
                      {!isIndividualDomain && seatInfo?.isSeatsModel
                        ? (seatInfo.totalSeats === 0 ? t('photos.buySeatsToUnlock') : t('photos.buyMoreSeats'))
                        : planTier === 'free' ? t('photos.upgradeToPaid') : t('photos.buyMoreCredits')}
                    </span>
                  </Link>
                  {/* Tooltip */}
                  <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                    effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                  }`}>
                    {!isIndividualDomain && seatInfo?.isSeatsModel
                      ? (seatInfo.totalSeats === 0 ? t('photos.buySeatsToUnlock') : t('photos.buyMoreSeats'))
                      : planTier === 'free' ? t('photos.upgradeToPaid') : t('photos.buyMoreCredits')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* User Profile w/ expandable menu (expands upwards) */}
          {session?.user && (
            <div className={`px-3 py-3 border-t ${sidebarBorderClass} relative`}>
            <div
              className="relative group flex items-center cursor-pointer hover:bg-gray-100/80 rounded-xl p-2 -mx-1 transition-all duration-300"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="user-menu"
            >
              <Image
                className="h-9 w-9 rounded-full bg-gray-200 flex-shrink-0"
                src={session?.user?.image || `https://ui-avatars.com/api/?name=${session?.user?.email}&background=${BRAND_CONFIG.colors.primary.replace('#', '')}&color=ffffff`}
                alt="User avatar"
                width={36}
                height={36}
                style={{ width: 'auto', height: 'auto' }}
                unoptimized
              />
              {/* User info - transitions smoothly */}
              <div 
                className={`min-w-0 transition-all duration-300 ease-in-out overflow-hidden ${
                  effectiveCollapsed 
                    ? 'w-0 opacity-0 ml-0' 
                    : 'w-auto opacity-100 ml-3 flex-1'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate whitespace-nowrap">
                  {session?.user?.name || session?.user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 truncate whitespace-nowrap">
                  {session?.user?.email}
                </p>
              </div>
              {/* Tooltip */}
              <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium transition-all duration-200 z-[9999] shadow-lg ${
                effectiveCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
              }`}>
                {session?.user?.name || session?.user?.email}
              </span>
            </div>
            {menuOpen && (
              <div className={`absolute rounded-xl border border-gray-200 bg-white shadow-lg z-[9999] overflow-hidden ${
                effectiveCollapsed
                  ? 'left-full ml-2 bottom-0 w-48'
                  : 'bottom-full mb-2 left-2 right-2'
              }`}>
                <Link
                  href="/app/settings"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                  onClick={() => {
                    setMenuOpen(false)
                    onMenuItemClick?.()
                  }}
                >
                  <Cog6ToothIcon className="h-4 w-4 text-gray-500" />
                  <span>{t('nav.settings')}</span>
                </Link>
                {session?.user?.isAdmin && (
                  <>
                    <div className="h-px bg-gray-100 mx-2" />
                    <Link
                      href="/app/admin"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                      onClick={() => {
                        setMenuOpen(false)
                        onMenuItemClick?.()
                      }}
                    >
                      <ShieldCheckIcon className="h-4 w-4 text-gray-500" />
                      <span>{t('nav.admin')}</span>
                    </Link>
                  </>
                )}
                <div className="h-px bg-gray-100 mx-2" />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    handleSignOut()
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2.5"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 text-gray-500" />
                  {t('profile.signOut')}
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
