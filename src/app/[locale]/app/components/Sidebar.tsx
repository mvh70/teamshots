'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/routing'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { jsonFetcher } from '@/lib/fetcher'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { 
  HomeIcon, 
  UsersIcon, 
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  UserIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import { BRAND_CONFIG, getBrandLogo } from '@/config/brand'
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
  AdjustmentsHorizontalIcon as AdjustmentsHorizontalIconSolid,
  UserIcon as UserIconSolid,
  CameraIcon as CameraIconSolid,
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
    case 'proSmall':
    case 'proLarge':
      return 'pro'
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
  initialRole?: SidebarRoleState
  initialAccountMode?: AccountMode
  initialSubscription?: SerializedSubscription | null
}

export default function Sidebar({ collapsed, onToggle, onMenuItemClick, initialRole, initialAccountMode, initialSubscription }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const t = useTranslations('app.sidebar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(initialRole?.isTeamMember ?? false)
  const [isTeamAdmin, setIsTeamAdmin] = useState(initialRole?.isTeamAdmin ?? false)
  const [needsTeamSetup, setNeedsTeamSetup] = useState(initialRole?.needsTeamSetup ?? false)
  const [, setNeedsPhotoStyleSetup] = useState(initialRole?.needsPhotoStyleSetup ?? false)
  const [, setNeedsTeamInvites] = useState(initialRole?.needsTeamInvites ?? false)
  const [, setNextTeamOnboardingStep] = useState<TeamOnboardingStep | null>(initialRole?.nextTeamOnboardingStep ?? null)
  const [allocatedCredits, setAllocatedCredits] = useState(0)
  const [accountMode, setAccountMode] = useState<AccountMode>(initialAccountMode ?? 'individual')
  const [navReady, setNavReady] = useState(Boolean(initialRole))
  const [planTier, setPlanTier] = useState<'free' | 'individual' | 'pro' | null>(null)
  const [planLabel, setPlanLabel] = useState<string | null>(null)
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

  // On mobile, always use collapsed styling (icons-only), but respect collapsed prop for visibility
  // On desktop, use collapsed prop for both visibility and styling
  const effectiveCollapsed = isMobile ? true : collapsed

  // Initialize subscription data from props if available
  useEffect(() => {
    if (initialSubscription) {
      const tierRaw = initialSubscription.tier ?? null
      const period = (initialSubscription.period as PlanPeriod) ?? null

      // Normalize tier for UI (checks period first to determine free plan)
      const normalized = normalizePlanTierForUI(tierRaw, period)
      setPlanTier(mapUITierToStateTier(normalized))

      // Compute human-readable label based on tier+period (transactional pricing)
      let label = 'Free package'
      if (isFreePlan(period)) {
        label = tierRaw === 'pro' ? 'Pro Free' : 'Individual Free'
      } else if (tierRaw === 'individual' && period === 'small') {
        label = 'Individual'
      } else if (tierRaw === 'pro' && period === 'small') {
        label = 'Pro Small'
      } else if (tierRaw === 'pro' && period === 'large') {
        label = 'Pro Large'
      } else {
        // Backward compatibility: handle legacy period values (cast to string for comparison)
        const periodStr = period ? String(period) : null
        if (tierRaw === 'individual') label = 'Individual'
        else if (periodStr === 'proSmall') label = 'Pro Small'
        else if (periodStr === 'proLarge') label = 'Pro Large'
      }
      setPlanLabel(label)
    }
  }, [initialSubscription])

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

  // Fetch allocated credits only for team admins - intentional data fetching on state change
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    const fetchAllocatedCredits = async () => {
      if (!isTeamAdmin) return
      try {
        const data = await jsonFetcher<{ totalAllocatedCredits: number; totalRemainingCredits: number }>('/api/team/invites/credits')
        // Show remaining credits across all invites (allocated minus used)
        setAllocatedCredits(data.totalRemainingCredits ?? 0)
      } catch (err) {
        setAllocatedCredits(0)
        console.error('Failed to fetch allocated credits:', err)
      }
    }

    // Only fetch if user is a team admin with an active team
    if (session?.user?.id && isTeamAdmin && !needsTeamSetup) {
      void fetchAllocatedCredits()
    } else if (!needsTeamSetup) {
      setAllocatedCredits(0)
    }
  }, [session?.user?.id, isTeamAdmin, needsTeamSetup])
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
              label = tierRaw === 'pro' ? 'Pro Free' : 'Individual Free'
            } else if (tierRaw === 'individual' && period === 'small') {
              label = 'Individual'
            } else if (tierRaw === 'pro' && period === 'small') {
              label = 'Pro Small'
            } else if (tierRaw === 'pro' && period === 'large') {
              label = 'Pro Large'
      } else {
        // Backward compatibility: handle legacy period values (cast to string for comparison)
        if (tierRaw === 'individual') label = 'Individual'
        else if (period && String(period) === 'proSmall') label = 'Pro Small'
        else if (period && String(period) === 'proLarge') label = 'Pro Large'
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
                  } else if (freshTier === 'individual') {
                    label = 'Individual'
                  } else if (freshTier === 'proSmall') {
                    label = 'Pro Small'
                  } else if (freshTier === 'proLarge') {
                    label = 'Pro Large'
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
        } else if (period && String(period) === 'proSmall') {
          label = 'Pro Small'
        } else if (period && String(period) === 'proLarge') {
          label = 'Pro Large'
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
      icon: AdjustmentsHorizontalIcon,
      iconSolid: AdjustmentsHorizontalIconSolid,
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
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      current: pathname === '/app/generations/team',
      showFor: ['team_member', 'team_admin'],
    },
    {
      name: t('nav.teamPhotoStyles'),
      href: '/app/styles/team',
      icon: AdjustmentsHorizontalIcon,
      iconSolid: AdjustmentsHorizontalIconSolid,
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
  // Pro mode: show pro/team features
  // Individual mode: show personal features
  // Team members (invited) don't have sidebar (handled separately)
  const navigation = accountMode === 'pro'
    ? roleFiltered.filter(item => proHrefs.has(item.href))
    : accountMode === 'individual'
    ? roleFiltered.filter(item => individualHrefs.has(item.href))
    : [] // team_member mode - no sidebar navigation

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
    
    // Always use current origin to ensure correct protocol (http vs https)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    signOut({ callbackUrl: `${baseUrl}/` })
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 border-r border-gray-200/80 transition-all duration-300 transform shadow-[2px_0_8px_0_rgb(0_0_0_/0.04),0_1px_2px_0_rgb(0_0_0_/0.02)] ${
      // Width: always collapsed (w-20) on mobile, respect effectiveCollapsed on desktop
      (isMobile ? 'w-20' : (effectiveCollapsed ? 'w-20' : 'w-64')) + ' ' + 
      // Visibility: use collapsed prop (when false, sidebar is visible)
      (collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0') + ' ' + 
      // Background: solid on mobile when visible, gradient on desktop
      (isMobile && !collapsed ? 'bg-white' : 'bg-gradient-to-b from-white via-gray-50/30 to-white') + ' ' +
      (effectiveCollapsed ? 'overflow-visible' : '')
    }`} style={{
      backgroundImage: isMobile && !collapsed ? 'none' : 'radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.03) 1px, transparent 0)',
      backgroundSize: '20px 20px'
    }}>
      <div className={`flex flex-col h-dvh max-h-screen ${effectiveCollapsed ? 'overflow-visible' : 'overflow-hidden'}`}>
        {/* Top Section - Header and Primary Action */}
        <div className="flex-shrink-0">
          {/* Header */}
          <div className={`flex p-5 md:p-6 border-b border-gray-200/60 bg-gradient-to-r from-white via-brand-primary-light/5 to-white backdrop-blur-sm ${effectiveCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between'}`}>
            {!effectiveCollapsed && (
              <Link href="/" className="flex items-center space-x-2 group/logo">
                <Image src={getBrandLogo('light')} alt={BRAND_CONFIG.name} width={112} height={28} className="h-7 transition-transform duration-200 group-hover/logo:scale-105" style={{ width: 'auto' }} priority />
              </Link>
            )}
            {effectiveCollapsed && (
              <Link href="/" className="w-12 h-12 rounded-lg flex items-center justify-center">
                <Image src={BRAND_CONFIG.logo.icon} alt={BRAND_CONFIG.name} width={48} height={48} className="h-12 w-12" priority />
              </Link>
            )}
            <div className="relative group">
              <button
                onClick={onToggle}
                aria-label={isMobile ? (collapsed ? 'Show menu' : 'Hide sidebar') : (effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
                className="p-2 md:p-1.5 rounded-lg hover:bg-brand-primary-light/50 hover:text-brand-primary transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
              >
                {/* On mobile: show hamburger when hidden, X when visible. On desktop: show chevrons */}
                {isMobile ? (
                  collapsed ? (
                    <Bars3Icon className="h-6 w-6 text-gray-500" />
                  ) : (
                    <XMarkIcon className="h-6 w-6 text-gray-500" />
                  )
                ) : (
                  effectiveCollapsed ? (
                    <ChevronRightIcon className="h-6 w-6 text-gray-500" />
                  ) : (
                    <ChevronLeftIcon className="h-6 w-6 text-gray-500" />
                  )
                )}
              </button>
              <span className={`pointer-events-none absolute ${effectiveCollapsed ? 'left-full ml-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm`}>
                {isMobile ? (
                  collapsed ? 'Show menu' : 'Hide sidebar'
                ) : (
                  effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                )}
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="px-4 pb-4 pt-3 relative group">
            <Link
              id="primary-generate-btn"
              href="/app/generate/start"
              onClick={onMenuItemClick}
              className={`flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary text-white rounded-lg px-4 py-3 md:py-3 font-semibold hover:from-brand-primary-hover hover:via-brand-primary hover:to-brand-primary-hover transition-all duration-300 min-h-[44px] md:min-h-0 shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                effectiveCollapsed ? 'px-2' : ''
              }`}
            >
                <PlusIcon className="h-6 w-6 md:h-7 md:w-7 transition-transform duration-300 group-hover:rotate-90" />
              {!effectiveCollapsed && <span className="text-sm md:text-base font-bold transition-all duration-200 leading-tight">{t('primary.generate')}</span>}
            </Link>
            {effectiveCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                {t('primary.generate')}
              </span>
            )}
          </div>
        </div>

        {/* Navigation - Takes up available space */}
        <nav className={`flex-1 px-4 py-3 space-y-1.5 min-h-0 overflow-y-auto overflow-x-visible overscroll-contain`} style={{ touchAction: 'pan-y' }}>
          {!effectiveCollapsed ? (
            <div className="h-full overflow-x-visible">
              {!navReady ? null : navigation.map((item) => {
                const Icon = item.current ? item.iconSolid : item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    id={item.id}
                    onClick={onMenuItemClick}
                    className={`group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ease-in-out relative min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                      item.current
                        ? 'bg-gradient-to-r from-brand-primary-light via-brand-primary-lighter to-brand-primary-light text-brand-primary shadow-sm shadow-brand-primary/10 border-l-2 border-brand-primary'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-brand-primary-light/20 hover:via-brand-primary-light/15 hover:to-transparent hover:text-brand-primary hover:shadow-sm hover:shadow-brand-primary/5 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-3 flex-shrink-0 transition-all duration-200 ease-in-out ${
                      item.current ? 'scale-110 text-brand-primary' : 'text-gray-600 group-hover:scale-110 group-hover:text-brand-primary'
                    }`} />
                    <span className={`transition-all duration-200 ease-in-out leading-relaxed font-semibold ${item.current ? 'font-bold' : ''}`}>{item.name}</span>
                    {item.current && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-brand-primary to-brand-primary-hover rounded-r-full shadow-sm shadow-brand-primary/20 transition-all duration-200" />
                    )}
                  </Link>
                )
              })}
            </div>
          ) : (
            <>
              {!navReady ? null : navigation.map((item) => {
                const Icon = item.current ? item.iconSolid : item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    id={item.id}
                    onClick={onMenuItemClick}
                    className={`group flex items-center justify-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out relative min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                      item.current
                        ? 'bg-gradient-to-r from-brand-primary-light via-brand-primary-lighter to-brand-primary-light text-brand-primary shadow-sm shadow-brand-primary/10 scale-105 ring-2 ring-brand-primary/20'
                        : 'text-gray-700 hover:bg-gradient-to-r hover:from-brand-primary-light/30 hover:via-brand-primary-light/20 hover:to-transparent hover:text-brand-primary hover:shadow-sm hover:shadow-brand-primary/5 hover:scale-110 active:scale-95'
                    }`}
                  >
                    <Icon className={`h-5 w-5 transition-all duration-200 ease-in-out ${
                      item.current ? 'scale-110 text-brand-primary' : 'text-gray-600 group-hover:scale-110 group-hover:text-brand-primary'
                    }`} />
                    <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                      {item.name}
                    </span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Bottom Section - Credits and User Profile (Fixed at bottom) */}
        <div className={`flex-shrink-0 bg-gradient-to-t from-white via-gray-50/40 to-white border-t border-gray-200/60 backdrop-blur-sm ${effectiveCollapsed ? 'overflow-visible' : ''}`}>
          {/* Credits Section */}
          {session?.user && (
            <div className="px-4 py-3 border-t border-gray-200/60">
              {/* Plan stamp just above credits */}
              {!effectiveCollapsed && planTier && (
                <div className="mb-3 flex justify-center">
                  <span
                    className={`inline-block rotate-[-3deg] px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded-lg border-2 border-dashed shadow-lg ${
                      planTier === 'pro'
                        ? 'bg-gradient-to-br from-brand-premium/20 via-brand-premium/10 to-brand-premium/20 text-brand-premium border-brand-premium/60'
                        : planTier === 'individual'
                        ? 'bg-gradient-to-br from-brand-primary-light via-brand-primary-lighter to-brand-primary-light text-brand-primary border-brand-primary/60'
                        : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 border-gray-400/60'
                    }`}
                  >
                    {planLabel ?? ''}
                  </span>
                </div>
              )}
              {!effectiveCollapsed && (
                <h3 className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-widest leading-tight">
                  {t('photos.title')}
                </h3>
              )}
              <div className={`space-y-1.5 ${effectiveCollapsed ? 'text-center' : ''}`}>
                {accountMode === 'individual' && (
                  <div className={`relative group flex items-center justify-between bg-gradient-to-r from-brand-primary-light/40 via-brand-primary-light/30 to-transparent rounded-lg px-2.5 py-2 border border-brand-primary/10 shadow-sm hover:shadow-md transition-shadow duration-200 ${effectiveCollapsed ? 'flex-col space-y-0.5' : ''}`}>
                    <span className={`text-xs font-semibold text-gray-800 leading-tight ${effectiveCollapsed ? 'text-center' : ''}`}>
                      {t('photos.individual')}
                    </span>
                    <span className={`text-lg md:text-xl font-extrabold tracking-tight leading-tight ${effectiveCollapsed ? 'text-xl' : ''}`} style={{ color: BRAND_CONFIG.colors.primary }}>
                      {calculatePhotosFromCredits(credits.individual ?? 0)}
                    </span>
                    {effectiveCollapsed && (
                      <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                        {t('photos.individual')}: {calculatePhotosFromCredits(credits.individual ?? 0)}
                      </span>
                    )}
                  </div>
                )}

                {accountMode === 'pro' && (
                  <>
                    <div className={`relative group flex items-center justify-between bg-gradient-to-r from-brand-primary-light/40 via-brand-primary-light/30 to-transparent rounded-lg px-2.5 py-2 border border-brand-primary/10 shadow-sm hover:shadow-md transition-shadow duration-200 ${effectiveCollapsed ? 'flex-col space-y-0.5' : ''}`}>
                      <span className={`text-xs font-semibold text-gray-800 leading-tight ${effectiveCollapsed ? 'text-center' : ''}`}>
                        {t('photos.team')}
                      </span>
                      <span className={`text-lg md:text-xl font-extrabold tracking-tight leading-tight ${effectiveCollapsed ? 'text-xl' : ''}`} style={{ color: BRAND_CONFIG.colors.primary }}>
                        {calculatePhotosFromCredits(credits.team ?? 0)}
                      </span>
                      {effectiveCollapsed && (
                        <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                          {t('photos.team')}: {calculatePhotosFromCredits(credits.team ?? 0)}
                        </span>
                      )}
                    </div>
                    {isTeamAdmin && allocatedCredits > 0 && (
                      <div className={`relative group flex items-center justify-between bg-gradient-to-r from-brand-cta-light/50 via-brand-cta-light/40 to-transparent rounded-lg px-2.5 py-2 border border-brand-cta/20 shadow-sm hover:shadow-md transition-shadow duration-200 ${effectiveCollapsed ? 'flex-col space-y-0.5' : ''}`}>
                        <span className={`text-xs font-semibold text-gray-800 leading-tight ${effectiveCollapsed ? 'text-center' : ''}`}>
                          {t('photos.allocated')}
                        </span>
                        <span className={`text-lg md:text-xl font-extrabold tracking-tight leading-tight ${effectiveCollapsed ? 'text-xl' : ''} text-brand-cta`}>
                          {calculatePhotosFromCredits(allocatedCredits)}
                        </span>
                        {effectiveCollapsed && (
                          <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                            {t('photos.allocated')}: {calculatePhotosFromCredits(allocatedCredits)}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Don't render sidebar for team_member mode (invited members) */}
                {accountMode === 'team_member' && null}
              </div>
              
              {/* Buy Credits Button */}
              <div className={`mt-3 ${effectiveCollapsed ? 'relative group' : ''}`}>
                {effectiveCollapsed ? (
                  <Link
                    href={planTier === 'free' ? '/app/upgrade' : '/app/top-up'}
                    onClick={onMenuItemClick}
                    className="w-full inline-flex items-center justify-center px-3 py-2.5 md:py-2 text-xs font-semibold text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-brand-cta to-brand-cta-hover hover:from-brand-cta-hover hover:to-brand-cta shadow-md shadow-brand-cta/20 hover:shadow-lg hover:shadow-brand-cta/30 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2 min-h-[44px] md:min-h-0"
                  >
                    <PlusIcon className="h-4 w-4 md:h-3 md:w-3 transition-transform duration-200 group-hover:rotate-90" />
                  </Link>
                ) : (
                  <Link
                    href={planTier === 'free' ? '/app/upgrade' : '/app/top-up'}
                    onClick={onMenuItemClick}
                    className="w-full inline-flex items-center justify-center px-3 py-2.5 md:py-2 text-xs md:text-xs font-semibold text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-brand-cta to-brand-cta-hover hover:from-brand-cta-hover hover:to-brand-cta shadow-md shadow-brand-cta/20 hover:shadow-lg hover:shadow-brand-cta/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2 min-h-[44px] md:min-h-0"
                  >
                    <PlusIcon className="h-4 w-4 md:h-3 md:w-3 mr-1 transition-transform duration-200 group-hover:rotate-90" />
                    {t('photos.buyMore')}
                  </Link>
                )}
                {effectiveCollapsed && (
                  <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                    {t('photos.buyMore')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* User Profile w/ expandable menu (expands upwards) */}
          {session?.user && (
            <div className="p-4 md:p-5 border-t border-gray-200/60 relative">
            <div
              className={`relative group flex items-center space-x-3 ${effectiveCollapsed ? 'justify-center' : ''} cursor-pointer hover:bg-gray-50/50 rounded-lg p-2 -mx-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2`}
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="user-menu"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-primary/40 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <Image
                  className="relative h-10 w-10 rounded-full bg-gray-200 ring-2 ring-brand-primary/20 group-hover:ring-brand-primary/40 transition-all duration-200"
                  src={session?.user?.image || `https://ui-avatars.com/api/?name=${session?.user?.email}&background=${BRAND_CONFIG.colors.primary.replace('#', '')}&color=ffffff`}
                  alt="User avatar"
                  width={40}
                  height={40}
                  style={{ width: 'auto', height: 'auto' }}
                />
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-brand-primary to-brand-primary-hover text-white text-xs rounded-full px-1.5 py-0.5 font-bold shadow-md ring-2 ring-white">
                  {t('profile.pro')}
                </div>
              </div>
              {!effectiveCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                    {session?.user?.name || session?.user?.email}
                  </p>
                  <p className="text-xs font-medium text-gray-600 truncate leading-relaxed mt-0.5">
                    {session?.user?.email}
                  </p>
                </div>
              )}
              {effectiveCollapsed && (
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 z-[9999] shadow-xl shadow-gray-900/30 backdrop-blur-sm">
                  {session?.user?.name || session?.user?.email}
                </span>
              )}
            </div>
            {menuOpen && (
              <div className={`absolute rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-md shadow-xl shadow-gray-900/20 z-[9999] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                effectiveCollapsed 
                  ? 'left-full ml-2 bottom-4 w-48' 
                  : 'bottom-16 left-4 right-4'
              }`}>
                <Link
                  href="/app/settings"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-brand-primary-light/50 hover:to-transparent transition-all duration-150"
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
                    <div className="h-px bg-gray-200" />
                    <Link
                      href="/app/admin"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent transition-all duration-150"
                      onClick={() => {
                        setMenuOpen(false)
                        onMenuItemClick?.()
                      }}
                    >
                      <ShieldCheckIcon className="h-4 w-4 text-red-500" />
                      <span>{t('nav.admin')}</span>
                    </Link>
                  </>
                )}
                <div className="h-px bg-gray-200" />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    handleSignOut()
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent transition-all duration-150 flex items-center gap-2"
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
