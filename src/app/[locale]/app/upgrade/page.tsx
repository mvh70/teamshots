'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice } from '@/domain/pricing/utils'
import { CheckoutButton } from '@/components/ui'
import StripeNotice from '@/components/stripe/StripeNotice'
import PricingCard from '@/components/pricing/PricingCard'
import { normalizePlanTierForUI } from '@/domain/subscription/utils'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'

type Tier = 'individual' | 'pro'

export default function UpgradePage() {
  const t = useTranslations('pricing')
  const tAll = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [selectedTier, setSelectedTier] = useState<Tier>('individual')

  // Check for success state
  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')
  // Get returnTo parameter if user came from another page (e.g., generation page)
  const returnTo = searchParams.get('returnTo')
  
  // Auto-checkout params (from signup flow)
  const autoCheckout = searchParams.get('autoCheckout') === 'true'
  const planParam = searchParams.get('plan')
  const periodParam = searchParams.get('period')
  const [isAutoCheckingOut, setIsAutoCheckingOut] = useState(false)

  // Auto-checkout effect
  useEffect(() => {
    if (!isAutoCheckingOut && autoCheckout && planParam && periodParam && !isCheckingSubscription && !isSuccess) {
      const performAutoCheckout = async () => {
        setIsAutoCheckingOut(true)
        try {
          let priceId = ''
          if (planParam === 'individual' && periodParam === 'small') {
            priceId = PRICING_CONFIG.individual.stripePriceId
          } else if (planParam === 'pro' && periodParam === 'small') {
            priceId = PRICING_CONFIG.proSmall.stripePriceId
          } else if (planParam === 'pro' && periodParam === 'large') {
            priceId = PRICING_CONFIG.proLarge.stripePriceId
          }

          if (priceId) {
            const res = await fetch('/api/stripe/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'plan',
                priceId,
                metadata: {
                  planTier: planParam,
                  planPeriod: periodParam
                },
                returnUrl: returnTo ? decodeURIComponent(returnTo) : undefined
              })
            })
            
            if (res.ok) {
              const data = await res.json()
              if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl
              }
            }
          }
        } catch (error) {
          console.error('Auto-checkout failed:', error)
          setIsAutoCheckingOut(false)
        }
      }
      performAutoCheckout()
    }
  }, [autoCheckout, planParam, periodParam, isCheckingSubscription, isSuccess, isAutoCheckingOut, returnTo])

  // Check subscription and determine tier
  useEffect(() => {
    // Don't check subscription or redirect if we're showing the success screen
    if (isSuccess) {
      setIsCheckingSubscription(false)
      return
    }

    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/user/subscription')
        if (response.ok) {
          const data = await response.json()
          const subscription = data?.subscription
          if (subscription) {
            const uiTier = normalizePlanTierForUI(subscription.tier, subscription.period)
            
            // If user has an active paid subscription, redirect to top-up
            // But only if we're not showing the success screen
            if (uiTier !== 'free' && !isSuccess) {
              router.push('/app/top-up')
              return
            }
            
            // For free users, use their chosen tier (individual or pro)
            if (subscription.tier === 'pro' || subscription.tier === 'individual') {
              setSelectedTier(subscription.tier)
            }
          }
        }
      } catch (error) {
        console.error('Failed to check subscription:', error)
      } finally {
        setIsCheckingSubscription(false)
      }
    }

    checkSubscription()
  }, [router, isSuccess])

  // Clear success params from URL after display (prevents showing on refresh)
  useEffect(() => {
    if (isSuccess && (successType === 'individual_success' || successType === 'pro_small_success' || successType === 'pro_large_success')) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('success')
      newUrl.searchParams.delete('type')
      newUrl.searchParams.delete('tier')
      newUrl.searchParams.delete('period')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [isSuccess, successType])

  // Checkout handled via CheckoutButton components below

  // Determine which plans to show based on selected tier
  const plansToShow = useMemo(() => {
    const individualPlan = {
      id: 'individual' as const,
      price: `$${PRICING_CONFIG.individual.price}`,
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
      popular: true,
      pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    }

    const proSmallPlan = {
      id: 'proSmall' as const,
      price: `$${PRICING_CONFIG.proSmall.price}`,
      credits: PRICING_CONFIG.proSmall.credits,
      regenerations: PRICING_CONFIG.regenerations.proSmall,
      popular: true,
      pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
    }

    const proLargePlan = {
      id: 'proLarge' as const,
      price: `$${PRICING_CONFIG.proLarge.price}`,
      credits: PRICING_CONFIG.proLarge.credits,
      regenerations: PRICING_CONFIG.regenerations.proLarge,
      pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
    }

    if (selectedTier === 'individual') {
      return [individualPlan]
    }
    // For 'pro' tier, show both proSmall and proLarge
    return [proSmallPlan, proLargePlan]
  }, [selectedTier])

  // If success state, show purchase success screen (check this first to avoid redirects)
  if (isSuccess && (successType === 'try_once_success' || successType === 'individual_success' || successType === 'pro_small_success' || successType === 'pro_large_success')) {
    return <PurchaseSuccess />
  }

  // Show loading while checking subscription or auto-checking out
  if (isCheckingSubscription || isAutoCheckingOut) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">{isAutoCheckingOut ? 'Redirecting to checkout...' : 'Loading...'}</p>
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
        {/* Billing toggle hidden - now transactional pricing only */}
        {/* <BillingToggle isYearly={isYearly} onChange={setIsYearly} className="mt-6" /> */}
      </div>

      <div className={`grid gap-8 ${
        plansToShow.length === 3 ? 'md:grid-cols-3' :
        plansToShow.length === 2 ? 'md:grid-cols-2' :
        'md:grid-cols-1'
      }`}>
        {plansToShow.map((plan) => (
          <PricingCard
            key={plan.id}
            {...plan}
            ctaSlot={
              <CheckoutButton
                loadingText={tAll('common.loading', { default: 'Loading...' })}
                type="plan"
                priceId={
                  plan.id === 'individual'
                    ? PRICING_CONFIG.individual.stripePriceId
                    : plan.id === 'proSmall'
                      ? PRICING_CONFIG.proSmall.stripePriceId
                      : PRICING_CONFIG.proLarge.stripePriceId
                }
                metadata={{
                  planTier: plan.id === 'individual' ? 'individual' : 'pro',
                  planPeriod: plan.id === 'proLarge' ? 'large' : 'small'
                }}
                returnUrl={returnTo ? decodeURIComponent(returnTo) : undefined}
                useBrandCtaColors
              >
                {t('plans.' + plan.id + '.cta')}
              </CheckoutButton>
            }
            popularLabelKey={(plan.id === 'individual' || plan.id === 'proSmall') ? "pricingPreview.recommended" : undefined}
            className="h-full"
          />
        ))}
      </div>
    </div>
  )
}


