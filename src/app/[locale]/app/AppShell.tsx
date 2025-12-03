'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { OnboardingLauncher } from '@/components/onboarding/OnboardingLauncher'

import { AccountMode } from '@/domain/account/accountMode'
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
  initialSubscription 
}: { 
  children: React.ReactNode
  initialRole?: InitialRole
  initialAccountMode?: AccountMode
  initialSubscription?: SerializedSubscription | null
}) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  
  const isGenerationFlow = pathname?.startsWith('/app/generate')

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
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-cta"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isGenerationFlow ? '' : 'overflow-x-hidden'}`}>
      <div className="flex relative">
        {showSidebar && (
          <>
            {/* Hover/touch zone on left edge for mobile - shows sidebar when hovered/touched (only when sidebar is hidden) */}
            {sidebarCollapsed && (
              <div 
                className="fixed left-0 top-0 bottom-0 w-8 z-50 lg:hidden"
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
                className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
                onClick={() => setSidebarCollapsed(true)}
                aria-hidden="true"
              />
            )}
            <Sidebar 
              collapsed={sidebarCollapsed} 
              initialRole={initialRole}
              initialAccountMode={initialAccountMode}
              initialSubscription={initialSubscription}
              onToggle={() => {
                setSidebarCollapsed(!sidebarCollapsed)
              }}
              onMenuItemClick={() => {
                // Auto-close sidebar on mobile when menu item is clicked
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setSidebarCollapsed(true)
                }
              }}
            />
          </>
        )}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            showSidebar ? (sidebarCollapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64') : 'ml-0'
          }`}
        >
          <Header onMenuClick={() => {
            setSidebarCollapsed(!sidebarCollapsed)
          }} />
          <main
            className={`
              flex-1 w-full min-w-0
              ${isGenerationFlow ? 'p-0 md:p-6 lg:p-8' : 'p-4 sm:p-6'}
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


