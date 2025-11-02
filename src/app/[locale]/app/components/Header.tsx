'use client'

import { Bars3Icon } from '@heroicons/react/24/outline'
import {useTranslations} from 'next-intl'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const t = useTranslations('app.header')
  const pathname = usePathname()
  const { data: session } = useSession()
  
  // Only show the dashboard header on the actual dashboard page
  const isDashboard = pathname === '/app/dashboard' || pathname.endsWith('/dashboard')
  
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Bars3Icon className="h-5 w-5 text-gray-500" />
          </button>
          {isDashboard && (
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
              <p className="text-sm text-gray-500">{t('subtitle')}</p>
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
