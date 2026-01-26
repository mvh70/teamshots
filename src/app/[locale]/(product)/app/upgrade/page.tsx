'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing/utils'
import StripeNotice from '@/components/stripe/StripeNotice'
import PricingCard from '@/components/pricing/PricingCard'
import SeatsPricingCard from '@/components/pricing/SeatsPricingCard'
import PlanCheckoutSection from '@/components/pricing/PlanCheckoutSection'
import { normalizePlanTierForUI } from '@/domain/subscription/utils'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'
import { fetchAccountMode, type AccountMode } from '@/domain/account/accountMode'

type Tier = 'individual' | 'pro'

export default function UpgradePage() {
  const t = useTranslations('pricing')
  const tAll = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [selectedTier, setSelectedTier] = useState<Tier>('individual')
  const [accountMode, setAccountMode] = useState<AccountMode | null>(null)
  const [currentSeats, setCurrentSeats] = useState<number>(0)

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
          } else if (planParam === 'vip') {
            priceId = PRICING_CONFIG.vip.stripePriceId
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

  // Fetch account mode to determine which pricing to show
  useEffect(() => {
    const loadAccountMode = async () => {
      try {
        const result = await fetchAccountMode()
        setAccountMode(result.mode)
        // Set selectedTier based on accountMode
        if (result.mode === 'pro') {
          setSelectedTier('pro')
        } else {
          setSelectedTier('individual')
        }
      } catch (error) {
        console.error('Failed to fetch account mode:', error)
        setAccountMode('individual')
        setSelectedTier('individual')
      }
    }

    loadAccountMode()
  }, [])

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
            
            // Store current seats if available
            if (data?.seatInfo?.totalSeats) {
              setCurrentSeats(data.seatInfo.totalSeats)
            }
            
            // If user has an active paid subscription, show top-up instead
            // But only if we're not showing the success screen
            if (uiTier !== 'free' && !isSuccess) {
              // For team/seats users, allow them to stay on this page to buy more seats
              if (uiTier === 'team') {
                // Don't redirect - let them use the seats top-up card
                setIsCheckingSubscription(false)
                return
              }
              // Individual/VIP users go to top-up for credit purchases
              router.push('/app/top-up')
              return
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
    if (isSuccess && (successType === 'individual_success' || successType === 'vip_success' || successType === 'seats_success')) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('success')
      newUrl.searchParams.delete('type')
      newUrl.searchParams.delete('tier')
      newUrl.searchParams.delete('period')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [isSuccess, successType])

  // Checkout handled via PlanCheckoutSection components below

  // Determine which plans to show based on selected tier
  const plansToShow = useMemo(() => {
    const individualPlan = {
      id: 'individual' as const,
      price: `$${PRICING_CONFIG.individual.price}`,
      credits: PRICING_CONFIG.individual.credits,
      regenerations: PRICING_CONFIG.regenerations.individual,
      popular: true,
      pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
      totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.individual.credits) * (1 + PRICING_CONFIG.regenerations.individual),
    }

    const vipPlan = {
      id: 'vip' as const,
      price: `$${PRICING_CONFIG.vip.price}`,
      credits: PRICING_CONFIG.vip.credits,
      regenerations: PRICING_CONFIG.regenerations.vip,
      pricePerPhoto: formatPrice(getPricePerPhoto('vip')),
      isVip: true,
      totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.vip.credits) * (1 + PRICING_CONFIG.regenerations.vip),
    }

    if (selectedTier === 'individual') {
      return [individualPlan, vipPlan]
    }
    // For 'pro' tier, redirect to seats-based pricing
    return []
  }, [selectedTier])

  // If success state, show purchase success screen (check this first to avoid redirects)
  if (isSuccess && (successType === 'try_once_success' || successType === 'individual_success' || successType === 'vip_success' || successType === 'seats_success')) {
    return <PurchaseSuccess />
  }

  // Show loading while checking subscription or auto-checking out
  if (isCheckingSubscription || isAutoCheckingOut) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">{isAutoCheckingOut ? t('redirectingToCheckout') : tAll('common.loading', { default: 'Loading...' })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <StripeNotice className="mb-6" />
      <div className="text-center mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        {/* Billing toggle hidden - now transactional pricing only */}
        {/* <BillingToggle isYearly={isYearly} onChange={setIsYearly} className="mt-6" /> */}
      </div>

      {/* Individual plans grid */}
      {plansToShow.length > 0 && (
        <div className={`grid gap-8 ${
          plansToShow.length === 3 ? 'md:grid-cols-3' :
          plansToShow.length === 2 ? 'md:grid-cols-2' :
          'md:grid-cols-1'
        }`}>
          {plansToShow.map((plan) => {
            const priceId = plan.id === 'individual'
              ? PRICING_CONFIG.individual.stripePriceId
              : PRICING_CONFIG.vip.stripePriceId
            const originalAmount = plan.id === 'individual'
              ? PRICING_CONFIG.individual.price
              : PRICING_CONFIG.vip.price
            const planTier = plan.id === 'individual' ? 'individual' : 'vip'
            const planPeriod = 'small'

            return (
              <PricingCard
                key={plan.id}
                {...plan}
                ctaSlot={
                  <PlanCheckoutSection
                    planId={plan.id}
                    priceId={priceId}
                    originalAmount={originalAmount}
                    planTier={planTier}
                    planPeriod={planPeriod}
                    ctaText={t('plans.' + plan.id + '.cta', { totalPhotos: plan.totalPhotos })}
                    isPopular={'popular' in plan && plan.popular}
                    unauth={false}
                  />
                }
                popularLabelKey={(plan.id === 'individual') ? "pricing.mostPopular" : undefined}
                className="h-full"
              />
            )
          })}
        </div>
      )}

      {/* Seats pricing for Pro tier */}
      {selectedTier === 'pro' && (
        <div className="max-w-2xl mx-auto">
          <SeatsPricingCard
            key={`seats-${currentSeats || 0}`}
            returnUrl={returnTo ? decodeURIComponent(returnTo) : undefined}
            currentSeats={currentSeats > 0 ? currentSeats : undefined}
          />
        </div>
      )}
    </div>
  )
}


