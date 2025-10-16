'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  HomeIcon, 
  UsersIcon, 
  PhotoIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import { BRAND_CONFIG } from '@/config/brand'
import { 
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  PhotoIcon as PhotoIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const t = useTranslations('app.sidebar')

  const navigation = [
    {
      name: t('nav.dashboard'),
      href: '/dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      current: pathname === '/dashboard' || pathname === '/app-routes/dashboard',
    },
    {
      name: t('nav.team'),
      href: '/team',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      current: pathname === '/team' || pathname === '/app-routes/team',
      badge: '1', // Example notification badge
    },
    {
      name: t('nav.generations'),
      href: '/generations',
      icon: PhotoIcon,
      iconSolid: PhotoIconSolid,
      current: pathname === '/generations' || pathname === '/app-routes/generations',
    },
    {
      name: t('nav.templates'),
      href: '/templates',
      icon: DocumentTextIcon,
      iconSolid: DocumentTextIconSolid,
      current: pathname === '/templates' || pathname === '/app-routes/templates',
    },
    {
      name: t('nav.analytics'),
      href: '/analytics',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      current: pathname === '/analytics' || pathname === '/app-routes/analytics',
    },
  ]

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <img src={BRAND_CONFIG.logo.light} alt={BRAND_CONFIG.name} className="h-7 w-auto" />
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto">
              <img src={BRAND_CONFIG.logo.icon} alt={BRAND_CONFIG.name} className="h-8 w-8" />
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronLeftIcon className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="p-4">
          <Link
            href="/generate"
            className={`flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white rounded-lg px-4 py-3 font-medium hover:from-brand-primary-hover hover:to-brand-primary transition-all duration-200 ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <PlusIcon className="h-5 w-5" />
            {!collapsed && <span>{t('primary.generate')}</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.current ? item.iconSolid : item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors relative ${
                  item.current
                    ? 'bg-brand-primary-light text-brand-primary'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
                {!collapsed && (
                  <>
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Credits Section */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className={`${collapsed ? 'text-center' : 'flex items-center justify-between'}`}>
            {!collapsed && <span className="text-sm font-medium text-gray-700">{t('credits.label')}</span>}
            {!collapsed && <span className="text-xs text-gray-500">{t('credits.monthlyReset')}</span>}
          </div>
          <div className="mt-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-brand-primary to-brand-primary-hover h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
              {!collapsed && <span className="text-xs text-gray-500">{t('credits.progress', {used: '25', total: '100'})}</span>}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="px-4 py-2 border-t border-gray-200">
          <Link
            href="/app-routes/settings"
            className={`flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <CogIcon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
            {!collapsed && <span>{t('nav.settings')}</span>}
          </Link>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center space-x-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="relative">
              <Image
                className="h-10 w-10 rounded-full bg-gray-200"
                src={session?.user?.image || `https://ui-avatars.com/api/?name=${session?.user?.email}&background=6366F1&color=ffffff`}
                alt="User avatar"
                width={40}
                height={40}
              />
              <div className="absolute -bottom-1 -right-1 bg-brand-primary text-white text-xs rounded-full px-1.5 py-0.5 font-medium">
                {t('profile.pro')}
              </div>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session?.user?.name || session?.user?.email}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email}
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="mt-3 w-full text-left px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t('profile.signOut')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
