'use client';

import { useTranslations } from 'next-intl';
import PricingCard from '@/components/pricing/PricingCard'
import SeatsPricingCard from '@/components/pricing/SeatsPricingCard'
import { CheckoutButton } from '@/components/ui'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing/utils'
import type { LandingVariant } from '@/config/landing-content'

// Helper to calculate total photos (styles × variations)
function getTotalPhotos(credits: number, regenerations: number): number {
  const styles = calculatePhotosFromCredits(credits)
  const variations = 1 + regenerations
  return styles * variations
}

interface PricingPreviewProps {
  /** Variant from server-side for domain-specific pricing (no client-side detection) */
  variant?: LandingVariant;
}

export default function PricingPreview({ variant }: PricingPreviewProps) {
  const t = useTranslations('pricing');

  // Derive signup type from server-provided variant (no client-side detection)
  const domainSignupType: 'individual' | 'team' | null =
    variant === 'photoshotspro' ? 'individual' :
    variant === 'teamshotspro' ? 'team' :
    null;

  // Seats-based pricing for TeamShotsPro
  if (variant === 'teamshotspro') {

    return (
      <section className="py-20 sm:py-24 lg:py-32 bg-bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20 xl:mb-24">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
              {t('seats.title')}
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
              {t('seats.subtitle')}
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
            {/* Seats Pricing Card */}
            <SeatsPricingCard unauth={true} />

            {/* Free Trial Card */}
            <PricingCard
              id="free"
              price="Free"
              credits={PRICING_CONFIG.freeTrial.pro}
              regenerations={PRICING_CONFIG.regenerations.free}
              pricePerPhoto={formatPrice(getPricePerPhoto('free'))}
              ctaMode="link"
              href="/auth/signup"
            />
          </div>

          {/* Personal Plan Redirect */}
          <div className="text-center mt-12 pt-8 border-t border-bg-gray-200">
            <p className="text-base text-text-body">
              Looking for a personal plan?{' '}
              <a
                href="https://photoshotspro.com"
                className="text-brand-primary font-semibold hover:underline transition-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit PhotoshotsPro.com
              </a>
            </p>
          </div>
        </div>
      </section>
    )
  }

  // VIP plan - high price anchor for individual domain
  const vipPlan = {
    id: 'vip' as const,
    price: `$${PRICING_CONFIG.vip.price}`,
    credits: PRICING_CONFIG.vip.credits,
    regenerations: PRICING_CONFIG.regenerations.vip,
    pricePerPhoto: formatPrice(getPricePerPhoto('vip')),
    isVip: true,
    totalPhotos: getTotalPhotos(PRICING_CONFIG.vip.credits, PRICING_CONFIG.regenerations.vip),
  }

  const individualPlan = {
    id: 'individual' as const,
    price: `$${PRICING_CONFIG.individual.price}`,
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
    popular: domainSignupType === 'individual', // Popular for individual domain
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.individual.credits, PRICING_CONFIG.regenerations.individual),
  }

  const freePlan = {
    id: 'free' as const,
    price: 'Free',
    credits: PRICING_CONFIG.freeTrial.individual,
    regenerations: PRICING_CONFIG.regenerations.free,
    pricePerPhoto: formatPrice(getPricePerPhoto('free')),
    totalPhotos: getTotalPhotos(
      PRICING_CONFIG.freeTrial.individual,
      PRICING_CONFIG.regenerations.free
    ),
  }

  // Filter plans based on domain restrictions
  // Order: VIP (anchor) → Individual (popular) → Free
  // This creates price anchoring effect: $199.99 makes $19.99 feel like a steal
  const plansToShow = [
    // Show VIP for individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? [vipPlan] : []),
    // Show Individual for individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? [individualPlan] : []),
    // Always show Free plan last
    freePlan,
  ]

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 xl:mb-24">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
            {t('title')}
          </h2>
          <p className="text-lg sm:text-xl lg:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
          
          {/* Billing toggle hidden - now transactional pricing only */}
          {/* <div className="flex items-center justify-center mt-10 mb-8">
            <div className="relative bg-bg-white p-1.5 rounded-2xl inline-flex shadow-depth-lg border-2 border-brand-primary-lighter hover:border-brand-primary transition-all duration-300">
              <button
                onClick={() => setIsYearly(false)}
                className={`relative px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
                  !isYearly
                    ? 'bg-brand-primary text-white shadow-depth-md scale-105'
                    : 'text-text-body hover:text-brand-primary active:scale-95'
                }`}
                aria-pressed={!isYearly}
                aria-label={t('monthly')}
              >
                {t('monthly')}
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`relative px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
                  isYearly
                    ? 'bg-brand-primary text-white shadow-depth-md scale-105'
                    : 'text-text-body hover:text-brand-primary active:scale-95'
                }`}
                aria-pressed={isYearly}
                aria-label={t('yearly')}
              >
                {t('yearly')}
              </button>
            </div>
          </div> */}
        </div>

        {/* Pricing Cards (shared) */}
        {/* Grid adapts: 5 cards = scrollable on mobile, visible on desktop */}
        <div className={`grid gap-8 lg:gap-6 overflow-visible items-start ${
          plansToShow.length >= 5 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' :
          plansToShow.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
          plansToShow.length === 3 ? 'md:grid-cols-3' :
          plansToShow.length === 2 ? 'md:grid-cols-2 max-w-5xl mx-auto' :
          'md:grid-cols-1 max-w-md mx-auto'
        }`}>
          {plansToShow.map((plan) => {
            // Free plan still uses signup flow
            if (plan.id === 'free') {
              return (
                <PricingCard
                  key={plan.id}
                  {...plan}
                  ctaMode="link"
                  href="/auth/signup"
                  className="h-full"
                />
              )
            }
            
            // Paid plans use guest checkout (Stripe collects email)
            const priceId = plan.id === 'individual'
              ? PRICING_CONFIG.individual.stripePriceId
              : PRICING_CONFIG.vip.stripePriceId

            const planTier = 'individual'
            const planPeriod = plan.id === 'vip' ? 'large' : 'small'
            
            // Unified button styling for CheckoutButton - matches PricingCard button styling
            const baseButtonClasses = '!rounded-xl lg:!rounded-2xl w-full text-center !px-4 !py-3 lg:!px-6 lg:!py-4 min-h-[3.5rem] lg:min-h-[4rem] !font-bold !text-sm lg:!text-base transition-all duration-300 flex items-center justify-center'
            const isPopular = 'popular' in plan && plan.popular
            const buttonVariantClasses = isPopular
              ? ''
              : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary border-2 border-transparent hover:border-brand-primary-lighter/50'
            
            return (
              <PricingCard
                key={plan.id}
                {...plan}
                ctaSlot={
                  <CheckoutButton
                    type="plan"
                    priceId={priceId}
                    unauth={true}
                    metadata={{
                      planTier,
                      planPeriod,
                    }}
                    useBrandCtaColors={isPopular}
                    className={`${baseButtonClasses} ${buttonVariantClasses}`.trim()}
                  >
                    {t(`plans.${plan.id}.cta`, { totalPhotos: plan.totalPhotos })}
                  </CheckoutButton>
                }
                className="h-full"
              />
            )
          })}
        </div>
      </div>
    </section>
  );
}