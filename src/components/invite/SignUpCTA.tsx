'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { getPersonalSignupTenantId, getTenantById } from '@/config/tenant'

interface SignUpCTAProps {
  className?: string
}

/**
 * Sign up CTA component for invite dashboard pages.
 * Prompts invited users to sign up for their own personal account.
 * Hidden on mobile devices.
 */
export default function SignUpCTA({ className = '' }: SignUpCTAProps) {
  const t = useTranslations('inviteDashboard')
  const { tenantId } = useTenant()

  const signUpUrl = useMemo(() => {
    const personalTenantId = getPersonalSignupTenantId(tenantId)
    const domain = getTenantById(personalTenantId).domain
    return `https://${domain}/auth/signup`
  }, [tenantId])

  return (
    <div data-testid="signup-cta" className={`hidden md:block bg-white rounded-lg shadow-md border border-gray-100 p-6 ${className}`}>
      <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
        {t('signUpCta.title')}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {t('signUpCta.description')}
      </p>
      <button
        onClick={() => window.location.href = signUpUrl}
        className="px-4 py-2 text-brand-primary border-2 border-brand-primary rounded-md text-sm font-medium transition-colors hover:bg-brand-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
      >
        {t('signUpCta.button')}
      </button>
    </div>
  )
}
