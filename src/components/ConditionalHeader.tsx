'use client'

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
  
  // Don't show header on app routes
  const isAppRoute = pathname.includes('/app/')
  
  if (isAppRoute) {
    return null
  }

  return (
    <header className="border-b bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
        <div className="flex items-center gap-6">
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
      </nav>
    </header>
  )
}
