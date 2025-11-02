'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { PRICING_CONFIG } from '@/config/pricing'
import { BRAND_CONFIG } from '@/config/brand'
import { getPricingDisplay } from '@/domain/pricing'
import CheckoutButton from '@/components/pricing/CheckoutButton'
import BillingToggle from '@/components/pricing/BillingToggle'
import StripeNotice from '@/components/stripe/StripeNotice'
import PricingCard from '@/components/pricing/PricingCard'

type Tier = 'individual' | 'pro'

export default function UpgradePage() {
  const t = useTranslations('pricing')
  const tDashboard = useTranslations('app.dashboard')
  const tAll = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pricing = getPricingDisplay()

  const initialTier = (searchParams.get('tier') as Tier) || 'individual'
  const [selectedTier] = useState<Tier>(initialTier)
  const [isYearly, setIsYearly] = useState(false)

  // Check for success state
  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')

  // Clear success params from URL after display (prevents showing on refresh)
  useEffect(() => {
    if (isSuccess && (successType === 'try_once_success' || successType === 'individual_success' || successType === 'pro_success')) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('success')
      newUrl.searchParams.delete('type')
      newUrl.searchParams.delete('tier')
      newUrl.searchParams.delete('period')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [isSuccess, successType])

  const subscriptionPriceId = useMemo(() => {
    if (selectedTier === 'individual') {
      return isYearly ? PRICING_CONFIG.individual.annual.stripePriceId : PRICING_CONFIG.individual.monthly.stripePriceId
    }
    return isYearly ? PRICING_CONFIG.pro.annual.stripePriceId : PRICING_CONFIG.pro.monthly.stripePriceId
  }, [selectedTier, isYearly])

  // Checkout handled via CheckoutButton components below

  const tryOncePlan = {
    id: 'tryOnce' as const,
    price: pricing.tryOnce.price,
    credits: pricing.tryOnce.credits,
    pricePerPhoto: pricing.tryOnce.pricePerPhoto,
    regenerations: pricing.tryOnce.regenerations,
  }

  const subscriptionPlan = selectedTier === 'individual'
    ? {
        id: 'individual' as const,
        price: pricing.individual.monthly.price,
        yearlyPrice: pricing.individual.annual.price,
        credits: pricing.individual.monthly.credits,
        monthlyPricePerPhoto: pricing.individual.monthly.pricePerPhoto,
        yearlyPricePerPhoto: pricing.individual.annual.pricePerPhoto,
        regenerations: pricing.individual.monthly.regenerations,
        annualSavings: pricing.individual.annual.savings,
        popular: true,
      }
    : {
        id: 'pro' as const,
        price: pricing.pro.monthly.price,
        yearlyPrice: pricing.pro.annual.price,
        credits: pricing.pro.monthly.credits,
        monthlyPricePerPhoto: pricing.pro.monthly.pricePerPhoto,
        yearlyPricePerPhoto: pricing.pro.annual.pricePerPhoto,
        regenerations: pricing.pro.monthly.regenerations,
        annualSavings: pricing.pro.annual.savings,
        popular: true,
      }

  // If success state, show success message instead of pricing cards
  if (isSuccess && (successType === 'try_once_success' || successType === 'individual_success' || successType === 'pro_success')) {
    let successMessage = ''
    let successTitle = ''
    
    if (successType === 'try_once_success') {
      successTitle = tDashboard('successMessages.titleTryOnce', { default: "All set! 🎉" })
      successMessage = tDashboard('successMessages.tryOnce', { default: 'Your purchase was successful! Credits added to your account.', credits: PRICING_CONFIG.tryOnce.credits })
    } else if (successType === 'individual_success') {
      successTitle = tDashboard('successMessages.titleIndividual', { default: "You're in! 🚀" })
      successMessage = tDashboard('successMessages.individual', { default: 'Subscription activated successfully.', credits: PRICING_CONFIG.individual.includedCredits })
    } else if (successType === 'pro_success') {
      successTitle = tDashboard('successMessages.titlePro', { default: "Pro unlocked! 🎯" })
      successMessage = tDashboard('successMessages.pro', { default: 'Pro subscription activated successfully.', credits: PRICING_CONFIG.pro.includedCredits })
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="border rounded-lg p-6 shadow-sm bg-green-50 border-green-200">
          <h1 className="text-2xl font-semibold mb-2 text-green-900">
            {successTitle}
          </h1>
          <p className="text-green-800 mb-4">
            {successMessage}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/app/dashboard')}
              className="px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta }}
            >
              {tAll('app.sidebar.nav.dashboard', { default: 'Dashboard' })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <StripeNotice className="mb-6" />
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        <BillingToggle isYearly={isYearly} onChange={setIsYearly} className="mt-6" />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <PricingCard
          {...tryOncePlan}
          isYearly={false}
          ctaSlot={
            <CheckoutButton
              label={t('plans.tryOnce.cta')}
              loadingLabel={tAll('common.loading', { default: 'Loading...' })}
              type="try_once"
              priceId={PRICING_CONFIG.tryOnce.stripePriceId}
            />
          }
          className="h-full"
        />

        <PricingCard
          {...subscriptionPlan}
          isYearly={isYearly}
          previousPrice={isYearly ? subscriptionPlan.price : undefined}
          ctaSlot={
            <CheckoutButton
              label={t('plans.' + subscriptionPlan.id + '.cta')}
              loadingLabel={tAll('common.loading', { default: 'Loading...' })}
              type="subscription"
              priceId={subscriptionPriceId}
              metadata={{ tier: selectedTier, period: isYearly ? 'annual' : 'monthly' }}
            />
          }
          popularLabelKey="pricingPreview.recommended"
          className="h-full"
        />
      </div>
    </div>
  )
}


