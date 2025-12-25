'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import PricingCard from '@/components/pricing/PricingCard'
import { CheckoutButton } from '@/components/ui'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing/utils'
import type { LandingVariant } from '@/config/landing-content'

// Client-side volume pricing calculation (duplicated from seats.ts to avoid server imports)
const VOLUME_TIERS = [
  { min: 25, max: Infinity, pricePerSeat: 15.96 },
  { min: 10, max: 24, pricePerSeat: 19.90 },
  { min: 1, max: 9, pricePerSeat: 29.00 }
] as const

function getVolumePrice(seatCount: number): number {
  if (seatCount < 1) return 0
  for (const tier of VOLUME_TIERS) {
    if (seatCount >= tier.min && seatCount <= tier.max) {
      return tier.pricePerSeat
    }
  }
  return VOLUME_TIERS[0].pricePerSeat
}

function calculateTotal(seats: number): number {
  if (seats < 1) return 0
  return seats * getVolumePrice(seats)
}

function getSavings(seats: number): number {
  if (seats < 1) return 0
  const baseTierPrice = VOLUME_TIERS[2].pricePerSeat
  const actualTotal = calculateTotal(seats)
  const baseTotal = seats * baseTierPrice
  return baseTotal - actualTotal
}

function getVolumeTier(seats: number): {
  tier: 'base' | 'medium' | 'large'
  pricePerSeat: number
  nextTierAt: number | null
  nextTierPrice: number | null
} {
  const pricePerSeat = getVolumePrice(seats)

  if (seats >= 25) {
    return {
      tier: 'large',
      pricePerSeat,
      nextTierAt: null,
      nextTierPrice: null
    }
  }

  if (seats >= 10) {
    return {
      tier: 'medium',
      pricePerSeat,
      nextTierAt: 25,
      nextTierPrice: VOLUME_TIERS[0].pricePerSeat
    }
  }

  return {
    tier: 'base',
    pricePerSeat,
    nextTierAt: 10,
    nextTierPrice: VOLUME_TIERS[1].pricePerSeat
  }
}

// Helper to calculate total photos (styles × variations)
function getTotalPhotos(credits: number, regenerations: number): number {
  const styles = calculatePhotosFromCredits(credits)
  const variations = 1 + regenerations
  return styles * variations
}

interface PricingContentProps {
  /** Variant from server-side for domain-specific pricing (no client-side detection) */
  variant?: LandingVariant;
}

export default function PricingContent({ variant }: PricingContentProps) {
  const t = useTranslations('pricing');
  const [seats, setSeats] = useState(10);

  // Derive signup type from server-provided variant (no client-side detection)
  const domainSignupType: 'individual' | 'team' | null =
    variant === 'photoshotspro' ? 'individual' :
    variant === 'teamshotspro' ? 'team' :
    null;

  // Seats-based pricing for TeamShotsPro
  if (variant === 'teamshotspro') {
    const pricePerSeat = getVolumePrice(seats);
    const total = calculateTotal(seats);
    const savings = getSavings(seats);
    const tierInfo = getVolumeTier(seats);
    const totalPhotos = seats * PRICING_CONFIG.seats.photosPerSeat;

    return (
      <div className="min-h-screen bg-bg-gray-50 py-20 lg:py-32 relative grain-texture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
              {t('seats.title')}
            </h1>
            <p className="text-xl text-text-body max-w-3xl mx-auto leading-relaxed">
              {t('seats.subtitle')}
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
            {/* Seats Pricing Card */}
            <div className="bg-bg-white rounded-3xl p-8 shadow-depth-lg hover:shadow-depth-xl transition-all duration-300 border-4 border-brand-primary relative">
              {/* Popular Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-brand-primary text-white px-6 py-2 rounded-full text-sm font-bold shadow-depth-md">
                  {t('mostPopular')}
                </span>
              </div>

              {/* Seats Selector */}
              <div className="mb-6 pt-4">
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-brand-primary font-display mb-2">
                    {seats} {seats === 1 ? t('seats.seat') : t('seats.seats')}
                  </div>
                  <div className="text-sm text-text-body">{t('seats.selectSeats')}</div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="w-full h-3 bg-brand-primary-lighter rounded-lg appearance-none cursor-pointer slider-thumb mb-3"
                  style={{
                    background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${((seats - 1) / 49) * 100}%, #E0E7FF ${((seats - 1) / 49) * 100}%, #E0E7FF 100%)`
                  }}
                />

                {/* Quick select buttons */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {[1, 5, 10, 25, 50].map((count) => (
                    <button
                      key={count}
                      onClick={() => setSeats(count)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        seats === count
                          ? 'bg-brand-primary text-white'
                          : 'bg-bg-gray-50 text-text-body hover:bg-brand-primary-lighter'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Display */}
              <div className="text-center mb-6 pb-6 border-b border-bg-gray-100">
                <div className="text-4xl font-bold text-text-dark font-display mb-2">
                  ${total.toFixed(2)}
                </div>
                <div className="text-sm text-text-body mb-2">
                  ${pricePerSeat.toFixed(2)} {t('seats.perSeat')}
                </div>
                {savings > 0 && (
                  <div className="text-sm font-semibold text-green-600">
                    Save ${savings.toFixed(2)}
                  </div>
                )}
                <div className="text-sm text-brand-primary font-semibold mt-2">
                  {totalPhotos} total photos
                </div>
              </div>

              {/* Volume Tier Hint */}
              {tierInfo.nextTierAt && (
                <div className="mb-6 p-3 bg-brand-primary-lighter/20 rounded-lg border border-brand-primary-lighter/50">
                  <p className="text-xs text-brand-primary font-semibold text-center">
                    💡 Add {tierInfo.nextTierAt - seats} more to unlock ${tierInfo.nextTierPrice?.toFixed(2)}/seat
                  </p>
                </div>
              )}

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {['photosPerSeat', 'professionalQuality', 'teamManagement', 'fastDelivery'].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <svg className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-text-body">{t(`seats.features.${feature}`)}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <CheckoutButton
                type="seats"
                priceId={PRICING_CONFIG.seats.stripePriceId}
                quantity={seats}
                unauth={true}
                metadata={{
                  planTier: 'pro',
                  planPeriod: 'seats',
                  seats: seats.toString(),
                }}
                useBrandCtaColors={true}
                className="w-full !rounded-xl !px-6 !py-4 !font-bold"
              >
                Get Started
              </CheckoutButton>
            </div>

            {/* Try It For Free Card */}
            <PricingCard
              id="tryItForFree"
              price="Free"
              credits={PRICING_CONFIG.freeTrial.pro}
              regenerations={PRICING_CONFIG.regenerations.tryItForFree}
              pricePerPhoto={formatPrice(getPricePerPhoto('tryItForFree'))}
              ctaMode="link"
              href="/auth/signup?period=tryItForFree"
            />
          </div>
        </div>
      </div>
    );
  }

  // Calculate pricing values for FAQ interpolation
  const individualPhotos = calculatePhotosFromCredits(PRICING_CONFIG.individual.credits)
  const individualVariations = 1 + PRICING_CONFIG.regenerations.individual
  const individualTotalPhotos = individualPhotos * individualVariations
  
  const proSmallPhotos = calculatePhotosFromCredits(PRICING_CONFIG.proSmall.credits)
  const proSmallVariations = 1 + PRICING_CONFIG.regenerations.proSmall
  const proSmallTotalPhotos = proSmallPhotos * proSmallVariations
  
  const proLargePhotos = calculatePhotosFromCredits(PRICING_CONFIG.proLarge.credits)
  const proLargeVariations = 1 + PRICING_CONFIG.regenerations.proLarge
  const proLargeTotalPhotos = proLargePhotos * proLargeVariations
  
  const maxVariations = Math.max(individualVariations, proSmallVariations, proLargeVariations)

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
    popular: domainSignupType === 'team' || domainSignupType === null, // Popular only when team-restricted or no restriction
    pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
    totalPhotos: getTotalPhotos(PRICING_CONFIG.proLarge.credits, PRICING_CONFIG.regenerations.proLarge),
  }

  const proSmallPlan = {
    id: 'proSmall' as const,
    price: `$${PRICING_CONFIG.proSmall.price}`,
    credits: PRICING_CONFIG.proSmall.credits,
    regenerations: PRICING_CONFIG.regenerations.proSmall,
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
    credits: (domainSignupType === 'team' || domainSignupType === null)
      ? PRICING_CONFIG.freeTrial.pro
      : PRICING_CONFIG.freeTrial.individual,
    regenerations: PRICING_CONFIG.regenerations.tryItForFree,
    pricePerPhoto: formatPrice(getPricePerPhoto('tryItForFree')),
    totalPhotos: getTotalPhotos(
      (domainSignupType === 'team' || domainSignupType === null)
        ? PRICING_CONFIG.freeTrial.pro
        : PRICING_CONFIG.freeTrial.individual,
      PRICING_CONFIG.regenerations.tryItForFree
    ),
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
    <div className="min-h-screen bg-bg-gray-50 py-20 lg:py-32 relative grain-texture">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 xl:mb-24">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
            {t('title')}
          </h1>
          <p className="text-xl text-text-body max-w-3xl mx-auto leading-relaxed">
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

        {/* Pricing Cards (using shared component) */}
        {/* Grid adapts: 5 cards = scrollable on mobile, 2-3 visible on desktop */}
        <div className={`grid gap-8 lg:gap-6 mb-16 overflow-visible ${
          plansToShow.length >= 5 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' :
          plansToShow.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
          plansToShow.length === 3 ? 'md:grid-cols-3' :
          plansToShow.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
          'md:grid-cols-1 max-w-md mx-auto'
        }`}>
          {plansToShow.map((plan) => {
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
                : plan.id === 'proLarge'
                  ? PRICING_CONFIG.proLarge.stripePriceId
                  : plan.id === 'vip'
                    ? PRICING_CONFIG.vip.stripePriceId
                    : PRICING_CONFIG.enterprise.stripePriceId
            
            const planTier = (plan.id === 'individual' || plan.id === 'vip') ? 'individual' : 'pro'
            const planPeriod = plan.id === 'proLarge' || plan.id === 'vip' || plan.id === 'enterprise' ? 'large' : 'small'
            
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

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-12 text-text-dark">
            {t('faq.title')}
          </h2>
          <div className="space-y-6">
            {['freeGen', 'howCreditsWork', 'topUp', 'satisfaction'].map((faqKey) => {
              // Get domain-specific answer key with fallback to base answer
              const getAnswerKey = (baseKey: string) => {
                const faqData = t.raw(`faq.questions.${faqKey}`) as Record<string, string> | undefined;
                
                if (domainSignupType === 'team') {
                  const teamKey = `${baseKey}Team`;
                  // Check if the team-specific key exists in the raw data
                  if (faqData && teamKey in faqData) {
                    return teamKey;
                  }
                } else if (domainSignupType === 'individual') {
                  const individualKey = `${baseKey}Individual`;
                  // Check if the individual-specific key exists in the raw data
                  if (faqData && individualKey in faqData) {
                    return individualKey;
                  }
                }
                // Fall back to base answer key
                return baseKey;
              };
              
              const answerKey = getAnswerKey('answer');
              
              // Prepare interpolation values for FAQ answers
              const faqValues = {
                individualPrice: formatPrice(PRICING_CONFIG.individual.price),
                individualPhotos: individualTotalPhotos.toString(),
                proSmallPrice: formatPrice(PRICING_CONFIG.proSmall.price),
                proSmallPhotos: proSmallTotalPhotos.toString(),
                proLargePrice: formatPrice(PRICING_CONFIG.proLarge.price),
                proLargePhotos: proLargeTotalPhotos.toString(),
                maxVariations: maxVariations.toString(),
              };
              
              return (
                <div key={faqKey} className="bg-bg-white rounded-2xl p-6 lg:p-8 shadow-depth-md hover:shadow-depth-lg transition-all duration-300">
                  <h3 className="text-lg lg:text-xl font-bold mb-3 text-text-dark font-display">
                    {t(`faq.questions.${faqKey}.question`)}
                  </h3>
                  <p className="text-base lg:text-lg text-text-body leading-relaxed">
                    {t(`faq.questions.${faqKey}.${answerKey}`, faqValues)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
