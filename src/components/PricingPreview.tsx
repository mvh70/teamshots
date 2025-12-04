'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import PricingCard from '@/components/pricing/PricingCard'
import { CheckoutButton } from '@/components/ui'
import { getClientDomain, getSignupTypeFromDomain, getForcedSignupType } from '@/lib/domain'
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
  /** Optional variant from server-side to prevent hydration flash */
  variant?: LandingVariant;
}

export default function PricingPreview({ variant }: PricingPreviewProps) {
  const t = useTranslations('pricing');

  // Map variant to signup type for initial render (prevents flash)
  const getInitialSignupType = (): 'individual' | 'team' | null => {
    if (variant === 'photoshotspro') return 'individual';
    if (variant === 'teamshotspro') return 'team';
    return null;
  };

  // Domain-based pricing restriction - use variant for initial SSR render
  const [domainSignupType, setDomainSignupType] = useState<'individual' | 'team' | null>(getInitialSignupType);
  const [isHydrated, setIsHydrated] = useState(false);

  // Verify domain type after hydration (client-side)
  useEffect(() => {
    const domain = getClientDomain();
    const forcedType = getForcedSignupType();
    const signupType = forcedType || getSignupTypeFromDomain(domain);
    setDomainSignupType(signupType);
    setIsHydrated(true);
  }, []);

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

  // Enterprise plan - high price anchor for team domain
  const enterprisePlan = {
    id: 'enterprise' as const,
    price: `$${PRICING_CONFIG.enterprise.price}`,
    credits: PRICING_CONFIG.enterprise.credits,
    regenerations: PRICING_CONFIG.regenerations.enterprise,
    pricePerPhoto: formatPrice(getPricePerPhoto('enterprise')),
    isVip: true, // Use VIP styling
    totalPhotos: getTotalPhotos(PRICING_CONFIG.enterprise.credits, PRICING_CONFIG.regenerations.enterprise),
  }

  const proLargePlan = {
    id: 'proLarge' as const,
    price: `$${PRICING_CONFIG.proLarge.price}`,
    credits: PRICING_CONFIG.proLarge.credits,
    regenerations: PRICING_CONFIG.regenerations.proLarge,
    pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.proLarge.credits, PRICING_CONFIG.regenerations.proLarge),
  }

  const proSmallPlan = {
    id: 'proSmall' as const,
    price: `$${PRICING_CONFIG.proSmall.price}`,
    credits: PRICING_CONFIG.proSmall.credits,
    regenerations: PRICING_CONFIG.regenerations.proSmall,
    popular: domainSignupType === 'team' || domainSignupType === null, // Popular only when team-restricted or no restriction
    pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.proSmall.credits, PRICING_CONFIG.regenerations.proSmall),
  }

  const individualPlan = {
    id: 'individual' as const,
    price: `$${PRICING_CONFIG.individual.price}`,
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.individual.credits, PRICING_CONFIG.regenerations.individual),
  }

  const tryItForFreePlan = {
    id: 'tryItForFree' as const,
    price: 'Free',
    credits: PRICING_CONFIG.tryItForFree.credits,
    regenerations: PRICING_CONFIG.regenerations.tryItForFree,
    pricePerPhoto: formatPrice(getPricePerPhoto('tryItForFree')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.tryItForFree.credits, PRICING_CONFIG.regenerations.tryItForFree),
  }

  // Filter plans based on domain restrictions
  // Order: VIP/Enterprise (anchor) → Pro Large → Pro Small (popular) → Individual → Free
  // This creates price anchoring effect: $399.99 makes $29.99 feel like a steal
  const anchorPlan = domainSignupType === 'individual' ? vipPlan : enterprisePlan
  
  const plansToShow = [
    // Show VIP for individual domain, Enterprise for team domain
    anchorPlan,
    // Show Pro Large and Pro Small if team domain or no domain restriction
    ...(domainSignupType === 'team' || domainSignupType === null ? [proLargePlan, proSmallPlan] : []),
    // Show Individual if individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? [individualPlan] : []),
    // Always show Try It For Free last
    tryItForFreePlan,
  ]

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-white">
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
            // VIP and Enterprise plans use contact sales link
            if (plan.id === 'vip' || plan.id === 'enterprise') {
              return (
                <PricingCard
                  key={plan.id}
                  {...plan}
                  ctaMode="link"
                  href="mailto:sales@teamshots.vip?subject=VIP%20Plan%20Inquiry"
                  className="h-full"
                />
              )
            }
            
            // Free plan still uses signup flow
            if (plan.id === 'tryItForFree') {
              return (
                <PricingCard
                  key={plan.id}
                  {...plan}
                  ctaMode="link"
                  href="/auth/signup?period=tryItForFree"
                  className="h-full"
                />
              )
            }
            
            // Paid plans use guest checkout (Stripe collects email)
            const priceId = plan.id === 'individual' 
              ? PRICING_CONFIG.individual.stripePriceId
              : plan.id === 'proSmall'
                ? PRICING_CONFIG.proSmall.stripePriceId
                : PRICING_CONFIG.proLarge.stripePriceId
            
            const planTier = plan.id === 'individual' ? 'individual' : 'pro'
            const planPeriod = plan.id === 'proLarge' ? 'large' : 'small'
            
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