'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import LanguageSwitcher from './LanguageSwitcher'
import { BRAND_CONFIGS } from '@/config/brand'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN } from '@/config/domain'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { LandingVariant } from '@/config/landing-content'

interface ConditionalHeaderProps {
  /** Variant from server-side to avoid hydration mismatch */
  variant?: LandingVariant;
}

export default function ConditionalHeader({ variant = 'teamshotspro' }: ConditionalHeaderProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { track } = useAnalytics()
  
  // Get brand config based on server-provided variant (no client-side detection)
  const brand = variant === 'photoshotspro' 
    ? BRAND_CONFIGS[INDIVIDUAL_DOMAIN] 
    : BRAND_CONFIGS[TEAM_DOMAIN]
  
  // Don't show header on app routes
  const isAppRoute = pathname.includes('/app/')
  
  if (isAppRoute) {
    return null
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <header className="border-b border-brand-primary-lighter bg-bg-white/95 backdrop-blur-sm shadow-depth-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center" aria-label={brand.name}>
            {/* Light background header uses the light logo variant */}
            {/* Using optimized image with proper sizing (913x141 source, displayed at ~120-150px width) */}
            <Image
              src={brand.logo.light}
              alt={brand.name}
              width={150}
              height={23}
              className="h-8 lg:h-10 w-auto"
              priority
              quality={85}
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          <Link 
            href="/" 
            className="text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
          >
            {t('home')}
          </Link>
          <Link 
            href="/pricing" 
            className="text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
          >
            {t('pricing')}
          </Link>
          <Link 
            href="/blog" 
            className="text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
          >
            {t('blog')}
          </Link>
          <LanguageSwitcher />
          <Link
            href={session ? "/app/dashboard" : "/auth/signin"}
            className="text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
          >
            {session ? t('dashboard') : t('signin')}
          </Link>
          <Link
            href="/auth/signup"
            onClick={() =>
              track('cta_clicked', {
                placement: 'header',
                action: 'signup',
                viewport: 'desktop',
              })
            }
            className="px-6 py-3 bg-brand-cta text-white rounded-xl hover:bg-brand-cta-hover transition-all duration-300 font-bold shadow-depth-md hover:shadow-depth-lg transform hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2"
          >
            {t('getStarted')}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-xl hover:bg-brand-primary-light transition-colors duration-300"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6 text-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-brand-primary-lighter bg-bg-white">
          <div className="px-4 py-4 space-y-4">
            <Link 
              href="/"
              onClick={toggleMobileMenu}
              className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-2"
            >
              {t('home')}
            </Link>
            <Link 
              href="/pricing"
              onClick={toggleMobileMenu}
              className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-2"
            >
              {t('pricing')}
            </Link>
            <Link 
              href="/blog"
              onClick={toggleMobileMenu}
              className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-2"
            >
              {t('blog')}
            </Link>
            <div className="py-2">
              <LanguageSwitcher />
            </div>
            <Link
              href={session ? "/app/dashboard" : "/auth/signin"}
              onClick={toggleMobileMenu}
              className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-2"
            >
              {session ? t('dashboard') : t('signin')}
            </Link>
            <Link
              href="/auth/signup"
              onClick={() => {
                toggleMobileMenu()
                track('cta_clicked', {
                  placement: 'header',
                  action: 'signup',
                  viewport: 'mobile',
                })
              }}
              className="block w-full text-center px-6 py-3 bg-brand-cta text-white rounded-xl hover:bg-brand-cta-hover transition-all duration-300 font-bold shadow-depth-md hover:shadow-depth-lg transform hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2"
            >
              {t('getStarted')}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
