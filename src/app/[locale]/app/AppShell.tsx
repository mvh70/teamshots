'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)
  // Guard to prevent rapid toggling
  const [lastAutoToggleAt, setLastAutoToggleAt] = useState(0)
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

  // Load pin state once on mount
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('app.sidebarPinned') : null
      if (stored != null) {
        const isPinned = stored === 'true'
        setSidebarPinned(isPinned)
        if (isPinned) setSidebarCollapsed(false)
      }
    } catch {}
  }, [])

  // Persist pin state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app.sidebarPinned', String(sidebarPinned))
      }
    } catch {}
  }, [sidebarPinned])

  // Proximity-based auto expand/collapse
  useEffect(() => {
    if (sidebarPinned) return
    const EXPANDED_WIDTH = 256 // Tailwind w-64
    const COLLAPSED_WIDTH = 80  // Tailwind w-20
    const EXPAND_EXTRA_MARGIN = 8   // additional px beyond collapsed width to trigger expand
    const COLLAPSE_MARGIN = 24  // px beyond sidebar to auto-collapse
    const MIN_INTERVAL_MS = 200 // debounce to avoid jitter

    const handleMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastAutoToggleAt < MIN_INTERVAL_MS) return

      const x = e.clientX

      // Expand when cursor enters the collapsed sidebar area (plus small margin)
      if (sidebarCollapsed && x <= (COLLAPSED_WIDTH + EXPAND_EXTRA_MARGIN)) {
        setSidebarCollapsed(false)
        setLastAutoToggleAt(now)
        return
      }

      // Collapse when cursor moves sufficiently away from expanded sidebar
      if (!sidebarCollapsed) {
        const collapseBoundary = EXPANDED_WIDTH + COLLAPSE_MARGIN
        if (x > collapseBoundary) {
          setSidebarCollapsed(true)
          setLastAutoToggleAt(now)
        }
      }
    }

    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [sidebarCollapsed, lastAutoToggleAt, sidebarPinned])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          pinned={sidebarPinned}
          onPinToggle={() => {
            // Pinning forces expanded state; unpinning keeps current state
            setSidebarPinned(!sidebarPinned)
            if (!sidebarPinned) setSidebarCollapsed(false)
          }}
        />
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}>
          <Header onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}


