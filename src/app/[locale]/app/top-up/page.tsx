'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PRICING_CONFIG } from '@/config/pricing'
import { useRouter, Link } from '@/i18n/routing'
import StripeNotice from '@/components/stripe/StripeNotice'
import { useSearchParams } from 'next/navigation'
import TopUpCard from '@/components/pricing/TopUpCard'
import { normalizePlanTierForUI, type PlanPeriod, type UIPlanTier } from '@/domain/subscription/utils'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'

export default function TopUpPage() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [planTier, setPlanTier] = useState<UIPlanTier | null>(null)
  // Local loading/error states are not used in UI here; omit to avoid lint warnings

  // Fetch subscription on mount - intentional data fetching
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const topUpDetails = useMemo(() => {
    if (planTier === 'proSmall') {
      return {
        tier: 'proSmall' as const,
        price: PRICING_CONFIG.proSmall.topUp.price,
        credits: PRICING_CONFIG.proSmall.topUp.credits,
      }
    }
    if (planTier === 'proLarge') {
      return {
        tier: 'proLarge' as const,
        price: PRICING_CONFIG.proLarge.topUp.price,
        credits: PRICING_CONFIG.proLarge.topUp.credits,
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
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    if (planTier === 'free') {
      router.push('/app/upgrade')
    }
  }, [planTier, router])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  // Errors are surfaced inside the nested components

  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')
  const returnTo = searchParams.get('returnTo')

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {isSuccess && successType === 'top_up_success' ? (
        <PurchaseSuccess />
      ) : (
        <>
        <StripeNotice className="mb-4" />
        <h1 className="text-2xl font-semibold mb-6">
          {t('pricing.topUpTitle', { default: 'Credit top-up' })}
        </h1>
        {planTier && planTier !== 'free' && topUpDetails ? (
          <TopUpCard tier={topUpDetails.tier} returnUrl={returnTo ? decodeURIComponent(returnTo) : undefined} />
        ) : planTier === 'free' ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">{t('pricing.topUpNotAvailableForFree', { default: 'Top-ups are not available on the free plan. Please purchase a plan to continue.' })}</p>
            <Link href="/app/upgrade" className="inline-block px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover">
              {t('pricing.viewPlans', { default: 'View Plans' })}
            </Link>
          </div>
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


