'use client'

import { Bars3Icon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import {useTranslations} from 'next-intl'
import { usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { useSession } from 'next-auth/react'
import { useDomain } from '@/contexts/DomainContext'

interface HeaderProps {
  /** Click handler for hamburger menu. Required unless standalone is true. */
  onMenuClick?: () => void
  /** When true, dispatches 'open-sidebar' event instead of using onMenuClick. */
  standalone?: boolean
  /** When true, shows a back chevron that navigates to /app/dashboard. */
  showBackToDashboard?: boolean
}

export default function Header({ onMenuClick, standalone = false, showBackToDashboard = false }: HeaderProps) {
  const t = useTranslations('app.header')
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isIndividualDomain } = useDomain()

  // Only show the dashboard header on the actual dashboard page
  // pathname includes locale prefix (e.g., /en/app/dashboard or /es/app/dashboard)
  const isDashboard = pathname?.endsWith('/app/dashboard') ?? false

  // pathname includes locale prefix, so check if it contains the route pattern
  const isGenerationFlow = pathname?.includes('/app/generate') ?? false

  const handleMenuClick = () => {
    if (standalone) {
      window.dispatchEvent(new CustomEvent('open-sidebar'))
    } else if (onMenuClick) {
      onMenuClick()
    }
  }

  const handleBackToDashboard = () => {
    router.push('/app/dashboard')
  }

  const borderClass = isIndividualDomain ? 'border-[#0F172A]/8' : 'border-gray-200'
  const headerClassName = standalone
    ? `bg-[var(--bg-white)] border-b ${borderClass} px-6 py-4`
    : `bg-[var(--bg-white)] border-b ${borderClass} px-6 py-4 ${isGenerationFlow ? 'hidden md:block' : ''}`

  return (
    <header className={headerClassName}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showBackToDashboard && (
            <button
              onClick={handleBackToDashboard}
              className={`p-2 rounded-md transition-colors ${isIndividualDomain ? 'hover:bg-[#0F172A]/5' : 'hover:bg-gray-100'}`}
              aria-label="Back to dashboard"
            >
              <ChevronLeftIcon className={`h-5 w-5 ${isIndividualDomain ? 'text-[#0F172A]/60' : 'text-gray-500'}`} />
            </button>
          )}
          <button
            onClick={handleMenuClick}
            className={`p-2 rounded-md transition-colors lg:hidden ${isIndividualDomain ? 'hover:bg-[#0F172A]/5' : 'hover:bg-gray-100'}`}
            aria-label="Open menu"
          >
            <Bars3Icon className={`h-5 w-5 ${isIndividualDomain ? 'text-[#0F172A]/60' : 'text-gray-500'}`} />
          </button>
          {isDashboard && (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-dark)]">{t('title')}</h1>
              <p className="text-sm text-[var(--text-muted)]">{isIndividualDomain ? t('subtitleIndividual') : t('subtitle')}</p>
            </div>
          )}
        </div>
        {session?.user?.impersonating && (
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/admin/impersonate', {
                  method: 'DELETE'
                })
                if (response.ok) {
                  window.location.href = '/app/dashboard'
                }
              } catch (err) {
                console.error('Failed to stop impersonation', err)
              }
            }}
            className="bg-yellow-100 border-2 border-yellow-400 text-yellow-900 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-yellow-200 transition-colors"
          >
            <span className="text-lg">🎭</span>
            <span className="text-sm font-medium">Impersonating User</span>
            <span className="text-xs ml-2 opacity-75">(Click to stop)</span>
          </button>
        )}
      </div>
    </header>
  )
}
