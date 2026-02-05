'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'

import { AccountMode } from '@/domain/account/accountMode'
import { SubscriptionInfo } from '@/domain/subscription/subscription'
import type { BrandColors } from '@/config/brand'

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

type InitialRole = {
  isTeamAdmin: boolean
  isTeamMember: boolean
  needsTeamSetup: boolean
  needsPhotoStyleSetup?: boolean
  needsTeamInvites?: boolean
  nextTeamOnboardingStep?: 'team_setup' | 'style_setup' | 'invite_members' | null
}

export default function AppShell({
  children,
  initialRole,
  initialAccountMode,
  initialSubscription,
  initialBrandName,
  initialBrandLogoLight,
  initialBrandLogoIcon,
  isIndividualDomain = false,
  brandColors
}: {
  children: React.ReactNode
  initialRole?: InitialRole
  initialAccountMode?: AccountMode
  initialSubscription?: SerializedSubscription | null
  initialBrandName?: string
  initialBrandLogoLight?: string
  initialBrandLogoIcon?: string
  isIndividualDomain?: boolean
  brandColors?: BrandColors
}) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  
  // pathname includes locale prefix, so check if it contains the route pattern
  const isGenerationFlow = pathname?.includes('/app/generate') ?? false

  // Hydration indicator for Playwright tests - intentional SSR pattern.
  // This allows tests to wait for React hydration to complete before interacting.
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    setHydrated(true)
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  useEffect(() => {
    if (hydrated && typeof document !== 'undefined') {
      document.body.classList.add('hydrated')
    }
  }, [hydrated])

  // Load sidebar collapsed state from localStorage on mount.
  // This is an intentional client-only initialization pattern since localStorage is not
  // available during SSR. We initialize with a default and then sync with localStorage after hydration.
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('app.sidebarCollapsed') : null
      if (stored != null) {
        const isCollapsed = stored === 'true'
        setSidebarCollapsed(isCollapsed)
      }
    } catch {}
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app.sidebarCollapsed', String(sidebarCollapsed))
      }
    } catch {}
  }, [sidebarCollapsed])

  // Don't show sidebar for team_member mode (invited members)
  const showSidebar = initialAccountMode !== 'team_member'

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!sidebarCollapsed && showSidebar && window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden'
        document.body.style.overscrollBehavior = 'none'
        // Prevent scroll on html element as well
        document.documentElement.style.overflow = 'hidden'
        document.documentElement.style.overscrollBehavior = 'none'
      } else {
        document.body.style.overflow = ''
        document.body.style.overscrollBehavior = ''
        document.documentElement.style.overflow = ''
        document.documentElement.style.overscrollBehavior = ''
      }
      return () => {
        document.body.style.overflow = ''
        document.body.style.overscrollBehavior = ''
        document.documentElement.style.overflow = ''
        document.documentElement.style.overscrollBehavior = ''
      }
    }
  }, [sidebarCollapsed, showSidebar])

  // Close sidebar on mobile when generation-detail tour starts
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleCloseSidebarForTour = () => {
      // Only close if we're on mobile and sidebar is currently open
      if (window.innerWidth < 1024 && !sidebarCollapsed && showSidebar) {
        setSidebarCollapsed(true)
      }
    }

    window.addEventListener('close-sidebar-for-tour', handleCloseSidebarForTour)
    return () => {
      window.removeEventListener('close-sidebar-for-tour', handleCloseSidebarForTour)
    }
  }, [sidebarCollapsed, showSidebar])

  // Open sidebar on mobile when standalone Header dispatches event
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOpenSidebar = () => {
      // Only open if we're on mobile and sidebar is available
      if (window.innerWidth < 1024 && showSidebar) {
        setSidebarCollapsed(false)
      }
    }

    window.addEventListener('open-sidebar', handleOpenSidebar)
    return () => {
      window.removeEventListener('open-sidebar', handleOpenSidebar)
    }
  }, [showSidebar])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    // Redirect team admins who need to set up their team to the team page
    // Skip redirect if already on team page to avoid infinite loop
    if (!isIndividualDomain && initialRole?.needsTeamSetup && initialRole?.isTeamAdmin && !pathname?.includes('/app/team')) {
      router.push('/app/team')
      return
    }
  }, [status, router, initialRole?.needsTeamSetup, initialRole?.isTeamAdmin, pathname])

  // Build CSS variables from brand colors - memoized to prevent unnecessary re-renders
  const brandStyle = useMemo(() =>
    brandColors ? {
      '--brand-primary': brandColors.primary,
      '--brand-primary-hover': brandColors.primaryHover,
      '--brand-cta': brandColors.cta,
      '--brand-cta-hover': brandColors.ctaHover,
      '--brand-secondary': brandColors.secondary,
      '--brand-secondary-hover': brandColors.secondaryHover,
      // Light canvas for all brands — Portreya uses warm ivory tones
      '--bg-white': isIndividualDomain ? '#FAFAF9' : '#FFFFFF',
      '--bg-gray-50': isIndividualDomain ? '#F5F0E8' : '#F9FAFB',
      // Text colors — dark text on light backgrounds for all brands
      '--text-dark': isIndividualDomain ? '#0F172A' : '#111827',
      '--text-body': isIndividualDomain ? '#334155' : '#374151',
      '--text-muted': isIndividualDomain ? '#64748B' : '#6B7280',
    } as React.CSSProperties : undefined,
    [brandColors, isIndividualDomain]
  )

  if (status === 'loading') {
    return (
      <div
        data-brand={isIndividualDomain ? 'portreya' : 'teamshotspro'}
        className="min-h-screen flex items-center justify-center"
        style={{ ...brandStyle, backgroundColor: 'var(--bg-gray-50)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-transparent" style={{ borderTopColor: brandColors?.cta || '#EA580C', borderRightColor: brandColors?.cta || '#EA580C' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      data-brand={isIndividualDomain ? 'portreya' : 'teamshotspro'}
      className={`min-h-screen ${isGenerationFlow ? '' : 'overflow-x-hidden'}`}
      style={{
        ...brandStyle,
        backgroundColor: isGenerationFlow ? (isIndividualDomain ? '#FAFAF9' : (brandColors?.primary || '#FFFFFF')) : undefined,
      }}
    >
      <div className="flex relative">
        {showSidebar && (
          <>
            {/* Hover/touch zone on left edge for mobile - shows sidebar when hovered/touched (only when sidebar is hidden) */}
            {sidebarCollapsed && (
              <div 
                className="fixed left-0 top-0 bottom-0 w-8 z-[100] lg:hidden"
                onMouseEnter={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setSidebarCollapsed(false)
                  }
                }}
                onTouchStart={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setSidebarCollapsed(false)
                  }
                }}
                aria-hidden="true"
              />
            )}
            {/* Backdrop overlay for mobile when sidebar is open */}
            {!sidebarCollapsed && (
              <div 
                className="fixed inset-0 bg-black/50 z-[90] lg:hidden transition-opacity duration-300"
                onClick={() => setSidebarCollapsed(true)}
                aria-hidden="true"
              />
            )}
            <Sidebar
              collapsed={sidebarCollapsed}
              initialRole={initialRole}
              initialAccountMode={initialAccountMode}
              initialSubscription={initialSubscription}
              initialBrandName={initialBrandName}
              initialBrandLogoLight={initialBrandLogoLight}
              initialBrandLogoIcon={initialBrandLogoIcon}
              isIndividualDomain={isIndividualDomain}
              onToggle={() => {
                setSidebarCollapsed(!sidebarCollapsed)
              }}
              onMenuItemClick={() => {
                // Auto-close sidebar on mobile when menu item is clicked
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarCollapsed(true)
                }
              }}
              onMouseEnter={() => {
                // Expand sidebar on hover (desktop only)
                if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                  setSidebarCollapsed(false)
                }
              }}
              onMouseLeave={() => {
                // Collapse sidebar when mouse leaves (desktop only)
                if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                  setSidebarCollapsed(true)
                }
              }}
            />
          </>
        )}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 relative z-0 bg-[var(--bg-gray-50)] ${
            showSidebar ? (sidebarCollapsed ? 'ml-0 lg:ml-20' : 'ml-0 lg:ml-64') : 'ml-0'
          }`}
        >
          {!isGenerationFlow && (
            <Header onMenuClick={() => {
              setSidebarCollapsed(!sidebarCollapsed)
            }} />
          )}
          <main
            className={`
              flex-1 w-full min-w-0
              ${isGenerationFlow ? 'pt-6 md:pt-8' : 'p-4 sm:p-6'}
              overflow-x-hidden
            `}
          >
            {children}
          </main>
        </div>
      </div>
      <OnboardingLauncher />
    </div>
  )
}


