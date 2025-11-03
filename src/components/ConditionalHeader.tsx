'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import LanguageSwitcher from './LanguageSwitcher'
import { BRAND_CONFIG } from '@/config/brand'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

export default function ConditionalHeader() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Don't show header on app routes
  const isAppRoute = pathname.includes('/app/')
  
  if (isAppRoute) {
    return null
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <header className="border-b bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center" aria-label={BRAND_CONFIG.name}>
            {/* Light background header uses the light logo variant */}
            <Image 
              src={BRAND_CONFIG.logo.light} 
              alt={BRAND_CONFIG.name} 
              width={120} 
              height={32} 
              className="h-8 w-auto" 
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6">
          <Link 
            href="/" 
            className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium"
          >
            {t('home')}
          </Link>
          <Link 
            href="/pricing" 
            className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium"
          >
            {t('pricing')}
          </Link>
          <LanguageSwitcher />
          <Link
            href={session ? "/app/dashboard" : "/auth/signin"}
            className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium"
          >
            {session ? t('dashboard') : t('signin')}
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 bg-brand-cta text-white rounded-lg hover:bg-brand-cta-hover transition-colors duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            {t('getStarted')}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-white">
          <div className="px-4 py-4 space-y-4">
            <Link 
              href="/"
              onClick={toggleMobileMenu}
              className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium py-2"
            >
              {t('home')}
            </Link>
            <Link 
              href="/pricing"
              onClick={toggleMobileMenu}
              className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium py-2"
            >
              {t('pricing')}
            </Link>
            <div className="py-2">
              <LanguageSwitcher />
            </div>
            <Link
              href={session ? "/app/dashboard" : "/auth/signin"}
              onClick={toggleMobileMenu}
              className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium py-2"
            >
              {session ? t('dashboard') : t('signin')}
            </Link>
            <Link
              href="/auth/signup"
              onClick={toggleMobileMenu}
              className="block w-full text-center px-4 py-2 bg-brand-cta text-white rounded-lg hover:bg-brand-cta-hover transition-colors duration-200 font-semibold shadow-sm"
            >
              {t('getStarted')}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
