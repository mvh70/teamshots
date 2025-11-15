'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { useRouter } from '@/i18n/routing'
import StripeNotice from '@/components/stripe/StripeNotice'
import { useSearchParams } from 'next/navigation'
import TopUpCard from '@/components/pricing/TopUpCard'
import { normalizePlanTierForUI, type PlanPeriod, type UIPlanTier } from '@/domain/subscription/utils'

export default function TopUpPage() {
  const t = useTranslations()
  const tDashboard = useTranslations('app.dashboard')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [planTier, setPlanTier] = useState<UIPlanTier | null>(null)
  // Local loading/error states are not used in UI here; omit to avoid lint warnings

  useEffect(() => {
    let isMounted = true
    const fetchSubscription = async () => {
      try {
        const res = await fetch('/api/user/subscription')
        if (!res.ok) throw new Error('Failed to load subscription')
        const data = (await res.json()) as { subscription?: { tier?: string | null; period?: PlanPeriod } | null }
        const tier = data?.subscription?.tier ?? null
        const period = data?.subscription?.period ?? null
        
        // Normalize tier for UI (checks period first to determine free plan)
        const normalized = normalizePlanTierForUI(tier, period)
        if (isMounted) setPlanTier(normalized)
      } catch {
        if (isMounted) setPlanTier('free')
      }
    }
    fetchSubscription()
    return () => { isMounted = false }
  }, [])

  const topUpDetails = useMemo(() => {
    if (planTier === 'pro') {
      return {
        tier: 'pro' as const,
        price: PRICING_CONFIG.pro.topUp.price,
        credits: PRICING_CONFIG.pro.topUp.credits,
      }
    }
    if (planTier === 'individual') {
      return {
        tier: 'individual' as const,
        price: PRICING_CONFIG.individual.topUp.price,
        credits: PRICING_CONFIG.individual.topUp.credits,
      }
    }
    return null
  }, [planTier])

  // Price-per-photo display is computed inside `TopUpCard`

  // Redirect free users away from the top-up page to the upgrade chooser
  useEffect(() => {
    if (planTier === 'free') {
      router.push('/app/upgrade')
    }
  }, [planTier, router])

  // Errors are surfaced inside the nested components

  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {isSuccess && successType === 'top_up_success' ? (
        <div className="border rounded-lg p-6 shadow-sm bg-brand-secondary-light border-brand-secondary-lighter">
          <h1 className="text-2xl font-semibold mb-2 text-brand-secondary-text-light">
            {tDashboard('successMessages.titleTopUp', { default: 'Credits loaded! ⚡' })}
          </h1>
          <p className="text-brand-secondary-text-light mb-4">
            {tDashboard('successMessages.topUp', { default: 'Credit top-up completed successfully! Your credits have been added to your account.' })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/app/dashboard')}
              className="px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta }}
            >
              {t('app.sidebar.nav.dashboard', { default: 'Dashboard' })}
            </button>
          </div>
        </div>
      ) : (
        <>
        <StripeNotice className="mb-4" />
        <h1 className="text-2xl font-semibold mb-6">
          {t('pricing.topUpTitle', { default: 'Credit top-up' })}
        </h1>
        {planTier && planTier !== 'free' && topUpDetails ? (
          <TopUpCard tier={topUpDetails.tier} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading', { default: 'Loading...' })}
          </div>
        )}
      </>
      )}
    </div>
  )
}


