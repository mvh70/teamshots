'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import LanguageSwitcher from './LanguageSwitcher'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { SOLUTIONS } from '@/config/solutions'
import type { LandingVariant } from '@/config/landing-content'

interface ConditionalHeaderProps {
  /** Brand name from server */
  brandName: string;
  /** Brand logo URL from server */
  brandLogo: string;
  /** Landing variant from server */
  variant: LandingVariant;
}

export default function ConditionalHeader({ brandName, brandLogo, variant }: ConditionalHeaderProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const { track } = useAnalytics()

  const isTeamShotsPro = variant === 'teamshotspro'

  // Don't show header on app routes or mobile upload-selfie page
  const isAppRoute = pathname.includes('/app/')
  const isUploadSelfiePage = pathname.includes('/upload-selfie/')

  if (isAppRoute || isUploadSelfiePage) {
    return null
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <header className="border-b border-brand-primary-lighter bg-bg-white shadow-depth-sm sticky top-0 z-50">
      <nav className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 h-16 lg:h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center" aria-label={brandName}>
            {/* Light background header uses the light logo variant */}
            {/* Using optimized image with proper sizing (913x141 source, displayed at ~120-150px width) */}
            <Image
              src={brandLogo}
              alt={brandName}
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

          {/* Solutions Dropdown - TeamShotsPro only */}
          {isTeamShotsPro && (
            <div
              className="relative"
              onMouseEnter={() => setSolutionsOpen(true)}
              onMouseLeave={() => setSolutionsOpen(false)}
            >
              <button
                className="flex items-center gap-1 text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
                aria-expanded={solutionsOpen}
                aria-haspopup="true"
              >
                {t('solutions')}
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${solutionsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu - pt-2 instead of mt-2 keeps hover area continuous */}
              {solutionsOpen && (
                <div className="absolute top-full left-0 pt-2 w-56 z-50">
                  <div className="bg-bg-white rounded-xl shadow-depth-lg border border-bg-gray-100 py-2">
                  {SOLUTIONS.map((solution) => (
                    <Link
                      key={solution.slug}
                      href={`/solutions/${solution.slug}`}
                      className="block px-4 py-2.5 text-sm text-text-body hover:bg-brand-primary-light hover:text-brand-primary transition-colors duration-200"
                    >
                      {t(`solutionLabels.${solution.slug}`)}
                    </Link>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
          {session ? (
            <Link
              href="/app/dashboard"
              className="px-6 py-3 bg-brand-secondary text-white rounded-xl hover:bg-brand-secondary-hover transition-all duration-300 font-bold shadow-depth-md hover:shadow-depth-lg transform hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2"
            >
              {t('dashboard')}
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="text-text-body hover:text-brand-primary transition-colors duration-300 font-medium"
            >
              {t('signin')}
            </Link>
          )}
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

            {/* Solutions Section - TeamShotsPro only */}
            {isTeamShotsPro && (
              <div className="py-2">
                <div className="text-text-muted text-sm font-semibold uppercase tracking-wide mb-2">
                  {t('solutions')}
                </div>
                <div className="space-y-1 pl-2">
                  {SOLUTIONS.map((solution) => (
                    <Link
                      key={solution.slug}
                      href={`/solutions/${solution.slug}`}
                      onClick={toggleMobileMenu}
                      className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-1.5 text-sm"
                    >
                      {t(`solutionLabels.${solution.slug}`)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
            {session ? (
              <Link
                href="/app/dashboard"
                onClick={toggleMobileMenu}
                className="block w-full text-center px-6 py-3 bg-brand-secondary text-white rounded-xl hover:bg-brand-secondary-hover transition-all duration-300 font-bold shadow-depth-md hover:shadow-depth-lg transform hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2"
              >
                {t('dashboard')}
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                onClick={toggleMobileMenu}
                className="block text-text-body hover:text-brand-primary transition-colors duration-300 font-medium py-2"
              >
                {t('signin')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
