'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

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

export default function AppShell({ 
  children, 
  initialRole, 
  initialAccountMode,
  initialSubscription 
}: { 
  children: React.ReactNode
  initialRole?: { isTeamAdmin: boolean, isTeamMember: boolean, needsTeamSetup: boolean }
  initialAccountMode?: AccountMode
  initialSubscription?: SerializedSubscription | null
}) {
  const { status } = useSession()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydration indicator for Playwright tests
  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && typeof document !== 'undefined') {
      document.body.classList.add('hydrated')
    }
  }, [hydrated])

  // Load sidebar collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('app.sidebarCollapsed') : null
      if (stored != null) {
        const isCollapsed = stored === 'true'
        setSidebarCollapsed(isCollapsed)
      }
    } catch {}
  }, [])

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app.sidebarCollapsed', String(sidebarCollapsed))
      }
    } catch {}
  }, [sidebarCollapsed])

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  // Don't show sidebar for team_member mode (invited members)
  const showSidebar = initialAccountMode !== 'team_member'

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="flex">
        {showSidebar && (
        <Sidebar 
          collapsed={sidebarCollapsed} 
          initialRole={initialRole}
          initialAccountMode={initialAccountMode}
          initialSubscription={initialSubscription}
          onToggle={() => {
            setSidebarCollapsed(!sidebarCollapsed)
          }}
        />
        )}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          showSidebar ? (sidebarCollapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64') : 'ml-0'
        }`}>
          <Header onMenuClick={() => {
            setSidebarCollapsed(!sidebarCollapsed)
          }} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}


