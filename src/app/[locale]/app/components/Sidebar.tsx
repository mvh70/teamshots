'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/routing'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { 
  HomeIcon, 
  UsersIcon, 
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  UserIcon,
  CameraIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import { BRAND_CONFIG } from '@/config/brand'
import { 
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  AdjustmentsHorizontalIcon as AdjustmentsHorizontalIconSolid,
  UserIcon as UserIconSolid,
  CameraIcon as CameraIconSolid,
} from '@heroicons/react/24/solid'

interface SidebarProps {
  collapsed: boolean
  pinned: boolean
  onPinToggle: () => void
  initialRole?: { isCompanyAdmin: boolean; isCompanyMember: boolean; needsCompanySetup: boolean }
  initialAccountMode?: 'individual' | 'company'
}

export default function Sidebar({ collapsed, pinned, onPinToggle, initialRole, initialAccountMode }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const t = useTranslations('app.sidebar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isCompanyMember, setIsCompanyMember] = useState(initialRole?.isCompanyMember ?? false)
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(initialRole?.isCompanyAdmin ?? false)
  const [needsCompanySetup, setNeedsCompanySetup] = useState(initialRole?.needsCompanySetup ?? false)
  const [allocatedCredits, setAllocatedCredits] = useState(0)
  const [accountMode, setAccountMode] = useState<'individual' | 'company'>(initialAccountMode ?? 'individual')
  const [navReady, setNavReady] = useState(Boolean(initialRole))
  const { credits } = useCredits()

  useEffect(() => {
    // Initialize role flags immediately from session to avoid UI flicker
    if (!initialRole && session?.user?.role) {
      setIsCompanyAdmin(session.user.role === 'company_admin')
      setIsCompanyMember(session.user.role === 'company_member')
      if ((session.user.role === 'company_admin' || session.user.role === 'company_member') && accountMode !== 'company') {
        setAccountMode('company')
      }
    }

    const fetchCompanyMembership = async () => {
      try {
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setIsCompanyMember(data.userRole.isCompanyMember || data.userRole.isCompanyAdmin)
          setIsCompanyAdmin(data.userRole.isCompanyAdmin)
          setNeedsCompanySetup(data.userRole.needsCompanySetup)
          setNavReady(true)
        }
      } catch (err) {
        console.error('Failed to fetch company membership:', err)
        setNavReady(true)
      }
    }

    if (session?.user?.id && !initialRole) {
      fetchCompanyMembership()
    }
  }, [session?.user?.id])

  // Coerce account mode to 'individual' for pure individual users
  useEffect(() => {
    if (!isCompanyAdmin && !isCompanyMember && accountMode !== 'individual') {
      setAccountMode('individual')
    }
  }, [isCompanyAdmin, isCompanyMember])

  // Fetch allocated credits only for team admins
  useEffect(() => {
    const fetchAllocatedCredits = async () => {
      try {
        const response = await fetch('/api/team/invites/credits')
        if (response.ok) {
          const data = await response.json()
          setAllocatedCredits(data.totalRemainingCredits)
        }
      } catch (err) {
        console.error('Failed to fetch allocated credits:', err)
      }
    }

    // Only fetch if user is a team admin
    if (session?.user?.id && isCompanyAdmin) {
      fetchAllocatedCredits()
    }
  }, [session?.user?.id, isCompanyAdmin])

  // Credits are now managed by CreditsContext

  // Fetch account mode (individual vs company) from settings
  useEffect(() => {
    const fetchAccountMode = async () => {
      try {
        const response = await fetch('/api/user/settings')
        if (response.ok) {
          const data = await response.json()
          const mode = (data as { settings?: { mode?: 'individual' | 'company' } }).settings?.mode
          if (mode === 'company' || mode === 'individual') {
            setAccountMode(mode)
          }
        }
      } catch (err) {
        console.error('Failed to fetch account mode:', err)
      }
    }

    if (session?.user?.id) {
      fetchAccountMode()
    }
  }, [session?.user?.id])

  // Custom pushpin icons (outline and solid) to represent pin/unpin
  const PushPinOutlineIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9.5 3.75l5 5m-7 2.5l7-7c.293-.293.768-.293 1.06 0l.94.94c.293.293.293.768 0 1.06l-2.12 2.12c-.3.3-.3.79 0 1.09l1.03 1.03c.47.47.14 1.27-.52 1.33l-3.69.34c-.21.02-.4.11-.55.26l-3.66 3.66c-.25.25-.65.25-.9 0l-.71-.71c-.25-.25-.25-.65 0-.9l3.66-3.66c.15-.15.24-.34.26-.55l.34-3.69c.06-.66.86-.99 1.33-.52l1.03 1.03c.3.3.79.3 1.09 0l2.12-2.12c.293-.293.293-.768 0-1.06l-.94-.94a.75.75 0 00-1.06 0l-7 7c-.2.2-.47.3-.75.27l-1.7-.16m6.33 8.88l4.24 4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const PushPinSolidIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14.44 2.94l6.62 6.62c.59.59.17 1.6-.66 1.67l-4.28.4-6.08 6.08 1.06 1.06-1.41 1.41-3.89-3.89 1.41-1.41 1.06 1.06 6.08-6.08.4-4.28c.07-.83 1.08-1.25 1.67-.66z"/>
    </svg>
  )

  const allNavigation = [
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
      href: '/app/contexts/personal',
      icon: AdjustmentsHorizontalIcon,
      iconSolid: AdjustmentsHorizontalIconSolid,
      current: pathname === '/app/contexts/personal',
      showFor: ['user', 'team_member', 'team_admin'],
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
      href: '/app/contexts/team',
      icon: AdjustmentsHorizontalIcon,
      iconSolid: AdjustmentsHorizontalIconSolid,
      current: pathname === '/app/contexts/team',
      showFor: ['team_admin'],
    },
    {
      name: t('nav.team'),
      href: '/app/team',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      current: pathname === '/team' || pathname === '/app/team',
      badge: needsCompanySetup ? '1' : undefined,
      showFor: ['team_admin'],
    },
  ]

  // Determine user role for navigation filtering
  const getUserRole = () => {
    if (isCompanyAdmin) {
      return 'team_admin'
    } else if (isCompanyMember) {
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
    '/app/contexts/personal',
    '/app/generations/personal',
  ])
  const companyHrefs = new Set([
    '/app/dashboard',
    '/app/selfies',
    '/app/generations/team',
    '/app/contexts/team',
    '/app/team',
  ])

  // If user is a pure individual, always show individual links regardless of stored account mode
  const navigation = (isCompanyAdmin || isCompanyMember)
    ? roleFiltered.filter(item => accountMode === 'company' ? companyHrefs.has(item.href) : individualHrefs.has(item.href))
    : roleFiltered.filter(item => individualHrefs.has(item.href))

  const handleSignOut = () => {
    // Always use current origin to ensure correct protocol (http vs https)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    signOut({ callbackUrl: `${baseUrl}/` })
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      <div className="flex flex-col h-screen">
        {/* Top Section - Header and Primary Action */}
        <div className="flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!collapsed && (
              <div className="flex items-center space-x-2">
                <Image src={BRAND_CONFIG.logo.light} alt={BRAND_CONFIG.name} width={112} height={28} className="h-7 w-auto" priority />
              </div>
            )}
            {collapsed && (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto">
                <Image src={BRAND_CONFIG.logo.icon} alt={BRAND_CONFIG.name} width={48} height={48} className="h-12 w-12" priority />
              </div>
            )}
            {!collapsed && (
              <div className="relative group">
                <button
                  onClick={onPinToggle}
                  aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {pinned ? (
                    <PushPinSolidIcon className="h-8 w-8 text-gray-500" />
                  ) : (
                    <PushPinOutlineIcon className="h-8 w-8 text-gray-500" />
                  )}
                </button>
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                </span>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="p-4">
            <Link
              href="/app/generations"
              className={`flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white rounded-lg px-4 py-3 font-medium hover:from-brand-cta-hover hover:to-brand-cta transition-all duration-200 ${
                collapsed ? 'px-2' : ''
              }`}
            >
              <PlusIcon className="h-8 w-8" />
              {!collapsed && <span>{t('primary.generate')}</span>}
            </Link>
          </div>
        </div>

        {/* Navigation - Takes up available space */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-h-0">
          {!navReady ? null : navigation.map((item) => {
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

        {/* Bottom Section - Credits and User Profile (Fixed at bottom) */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200">
          {/* Credits Section */}
          {session?.user && (
            <div className="px-4 py-3 border-t border-gray-200">
              {!collapsed && (
                <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  {t('credits.title')}
                </h3>
              )}
              <div className={`space-y-2 ${collapsed ? 'text-center' : ''}`}>
                {accountMode === 'individual' && (
                  <div className={`flex items-center justify-between ${collapsed ? 'flex-col space-y-1' : ''}`}>
                    <span className={`text-xs font-medium text-gray-500 ${collapsed ? 'text-center' : ''}`}>
                      {t('credits.individual')}
                    </span>
                    <span className={`text-sm font-semibold ${collapsed ? 'text-lg' : ''}`} style={{ color: BRAND_CONFIG.colors.primary }}>
                      {credits.individual}
                    </span>
                  </div>
                )}

                {accountMode === 'company' && (
                  <>
                    <div className={`flex items-center justify-between ${collapsed ? 'flex-col space-y-1' : ''}`}>
                      <span className={`text-xs font-medium text-gray-500 ${collapsed ? 'text-center' : ''}`}>
                        {t('credits.company')}
                      </span>
                      <span className={`text-sm font-semibold ${collapsed ? 'text-lg' : ''}`} style={{ color: BRAND_CONFIG.colors.primary }}>
                        {credits.company}
                      </span>
                    </div>
                    {isCompanyAdmin && allocatedCredits > 0 && (
                      <div className={`flex items-center justify-between ${collapsed ? 'flex-col space-y-1' : ''}`}>
                        <span className={`text-xs font-medium text-gray-500 ${collapsed ? 'text-center' : ''}`}>
                          {t('credits.allocated')}
                        </span>
                        <span className={`text-sm font-semibold ${collapsed ? 'text-lg' : ''} text-orange-600`}>
                          {allocatedCredits}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Buy Credits Button */}
              {!collapsed && (
                <div className="mt-3">
                  <Link
                    href="/pricing"
                    className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white rounded-md transition-colors"
                    style={{ backgroundColor: BRAND_CONFIG.colors.primary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primaryHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.primary
                    }}
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    {t('credits.buyMore')}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* User Profile w/ expandable menu (expands upwards) */}
          {session?.user && (
            <div className="p-4 border-t border-gray-200 relative">
            <div
              className={`flex items-center space-x-3 ${collapsed ? 'justify-center' : ''} cursor-pointer`}
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="user-menu"
            >
              <div className="relative">
                <Image
                  className="h-10 w-10 rounded-full bg-gray-200"
                  src={session?.user?.image || `https://ui-avatars.com/api/?name=${session?.user?.email}&background=${BRAND_CONFIG.colors.primary.replace('#', '')}&color=ffffff`}
                  alt="User avatar"
                  width={40}
                  height={40}
                  style={{ width: 'auto', height: 'auto' }}
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
            {!collapsed && menuOpen && (
              <div className="absolute bottom-16 left-4 right-4 rounded-lg border border-gray-200 bg-white shadow-lg">
                <Link
                  href="/app/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  onClick={() => setMenuOpen(false)}
                >
                  <Cog6ToothIcon className="h-4 w-4 text-gray-500" />
                  <span>{t('nav.settings')}</span>
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    handleSignOut()
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg flex items-center gap-2"
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
