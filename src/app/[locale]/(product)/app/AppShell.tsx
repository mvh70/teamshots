'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'
import { MOBILE_BREAKPOINT } from '@/hooks/useMobileViewport'

import { AccountMode } from '@/domain/account/accountMode'
import type { BrandColors } from '@/config/brand'
import type { TenantId } from '@/config/tenant'
import type { SerializedSubscription } from '@/types/subscription'

type InitialRole = {
  isTeamAdmin: boolean
  isTeamMember: boolean
  needsTeamSetup: boolean
  needsPhotoStyleSetup?: boolean
  needsTeamInvites?: boolean
  nextTeamOnboardingStep?: 'team_setup' | 'style_setup' | 'invite_members' | null
}

function getCanvasTokens(tenantId: TenantId, isIndividualDomain: boolean) {
  if (!isIndividualDomain) {
    return {
      bgWhite: '#FFFFFF',
      bgGray50: '#F9FAFB',
      textDark: '#111827',
      textBody: '#374151',
      textMuted: '#6B7280',
    }
  }

  if (tenantId === 'rightclickfit') {
    return {
      bgWhite: '#FAFAFF',
      bgGray50: '#F3F4FF',
      textDark: '#1F1B3A',
      textBody: '#3F3A64',
      textMuted: '#6B6790',
    }
  }

  return {
    bgWhite: '#FAFAF9',
    bgGray50: '#F5F0E8',
    textDark: '#0F172A',
    textBody: '#334155',
    textMuted: '#64748B',
  }
}

function readStoredSidebarCollapsed(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('app.sidebarCollapsed')
    if (stored == null) return null
    return stored === 'true'
  } catch {
    return null
  }
}

export default function AppShell({
  children,
  initialRole,
  initialAccountMode,
  initialSubscription,
  initialBrandName,
  initialBrandLogoLight,
  initialBrandLogoIcon,
  tenantId = 'teamshotspro',
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
  tenantId?: TenantId
  isIndividualDomain?: boolean
  brandColors?: BrandColors
}) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  
  // pathname includes locale prefix, so check if it contains the route pattern
  const isGenerationFlow = pathname?.includes('/app/generate') ?? false

  // Hydration indicator for Playwright tests.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.add('hydrated')
    return () => {
      document.body.classList.remove('hydrated')
    }
  }, [])

  // Load sidebar collapsed state from localStorage on mount.
  useEffect(() => {
    const storedCollapsed = readStoredSidebarCollapsed()
    if (storedCollapsed == null) return

    // Defer this initialization update to avoid synchronous render cascades in effect body.
    queueMicrotask(() => {
      setSidebarCollapsed(storedCollapsed)
    })
  }, [])

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
      if (!sidebarCollapsed && showSidebar && window.innerWidth < MOBILE_BREAKPOINT) {
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
      if (window.innerWidth < MOBILE_BREAKPOINT && !sidebarCollapsed && showSidebar) {
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
      if (window.innerWidth < MOBILE_BREAKPOINT && showSidebar) {
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
  }, [status, router, isIndividualDomain, initialRole?.needsTeamSetup, initialRole?.isTeamAdmin, pathname])

  // Build CSS variables from brand colors - memoized to prevent unnecessary re-renders
  const brandStyle = useMemo(() => {
    if (!brandColors) return undefined

    const canvas = getCanvasTokens(tenantId, isIndividualDomain)

    return {
      '--brand-primary': brandColors.primary,
      '--brand-primary-hover': brandColors.primaryHover,
      '--brand-cta': brandColors.cta,
      '--brand-cta-hover': brandColors.ctaHover,
      '--brand-secondary': brandColors.secondary,
      '--brand-secondary-hover': brandColors.secondaryHover,
      '--bg-white': canvas.bgWhite,
      '--bg-gray-50': canvas.bgGray50,
      '--text-dark': canvas.textDark,
      '--text-body': canvas.textBody,
      '--text-muted': canvas.textMuted,
    } as React.CSSProperties
  }, [brandColors, tenantId, isIndividualDomain])

  if (status === 'loading') {
    return (
      <div
        data-brand={tenantId}
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
      data-brand={tenantId}
      className={`min-h-screen ${isGenerationFlow ? '' : 'overflow-x-hidden'}`}
      style={{
        ...brandStyle,
        backgroundColor: isGenerationFlow ? 'var(--bg-gray-50)' : undefined,
      }}
    >
      <div className="flex relative">
        {showSidebar && (
          <>
            {/* Hover/touch zone on left edge for mobile - shows sidebar when hovered/touched (only when sidebar is hidden) */}
            {sidebarCollapsed && (
              <div 
                className="fixed left-0 top-0 bottom-0 w-4 z-[100] md:hidden"
                onTouchStart={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
                    setSidebarCollapsed(false)
                  }
                }}
                aria-hidden="true"
              />
            )}
            {/* Backdrop overlay for mobile when sidebar is open */}
            {!sidebarCollapsed && (
              <div 
                className="fixed inset-0 bg-black/50 z-[90] md:hidden transition-opacity duration-300"
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
              tenantId={tenantId}
              isIndividualDomain={isIndividualDomain}
              onToggle={() => {
                setSidebarCollapsed(!sidebarCollapsed)
              }}
              onMenuItemClick={() => {
                // Auto-close sidebar on mobile when menu item is clicked
                if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
                  setSidebarCollapsed(true)
                }
              }}
              onMouseEnter={() => {
                // Expand sidebar on hover (desktop only)
                if (typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT) {
                  setSidebarCollapsed(false)
                }
              }}
              onMouseLeave={() => {
                // Collapse sidebar when mouse leaves (desktop only)
                if (typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT) {
                  setSidebarCollapsed(true)
                }
              }}
            />
          </>
        )}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 relative z-0 bg-[var(--bg-gray-50)] ${
            showSidebar ? (sidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64') : 'ml-0'
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
