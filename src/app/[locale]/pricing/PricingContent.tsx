'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import PricingCard from '@/components/pricing/PricingCard'
import { CheckoutButton } from '@/components/ui'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing/utils'
import { getVolumePrice, calculateTotal, getSavings, getVolumeTier } from '@/domain/pricing/seats'
import type { LandingVariant } from '@/config/landing-content'

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
              {t('seats.title')}
            </h1>
            <p className="text-xl text-text-body max-w-3xl mx-auto leading-relaxed">
              {t('seats.subtitle')}
            </p>
          </div>

          {/* Pricing Calculator Card */}
          <div className="bg-bg-white rounded-3xl p-8 lg:p-12 shadow-depth-lg mb-12">
            {/* Seats Selector */}
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-lg font-bold text-text-dark font-display">
                  {t('seats.selectSeats')}
                </label>
                <div className="text-4xl font-bold text-brand-primary font-display">
                  {seats} {seats === 1 ? t('seats.seat') : t('seats.seats')}
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full h-3 bg-brand-primary-lighter rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${((seats - 1) / 49) * 100}%, #E0E7FF ${((seats - 1) / 49) * 100}%, #E0E7FF 100%)`
                }}
              />

              {/* Quick select buttons */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {[1, 5, 10, 25, 50].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSeats(count)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      seats === count
                        ? 'bg-brand-primary text-white shadow-depth-md'
                        : 'bg-bg-gray-50 text-text-body hover:bg-brand-primary-lighter hover:text-brand-primary'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Tier Indicator */}
            {tierInfo.nextTierAt && (
              <div className="mb-6 p-4 bg-brand-primary-lighter/30 rounded-xl border border-brand-primary-lighter">
                <p className="text-sm text-brand-primary font-semibold">
                  💡 {t('seats.volumeHint', {
                    seatsNeeded: tierInfo.nextTierAt - seats,
                    nextPrice: formatPrice(tierInfo.nextTierPrice ?? 0),
                    savingsPerSeat: formatPrice(pricePerSeat - (tierInfo.nextTierPrice ?? 0))
                  })}
                </p>
              </div>
            )}

            {/* Pricing Summary */}
            <div className="border-t border-bg-gray-100 pt-6 space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-text-body">{t('seats.pricePerSeat')}</span>
                <span className="text-2xl font-bold text-text-dark font-display">
                  ${pricePerSeat.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-text-body">{t('seats.totalPhotos')}</span>
                <span className="text-xl font-semibold text-brand-primary">
                  {totalPhotos} {t('seats.photos')}
                </span>
              </div>

              {savings > 0 && (
                <div className="flex justify-between items-baseline text-green-600">
                  <span className="font-semibold">{t('seats.savings')}</span>
                  <span className="text-xl font-bold">-${savings.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-bg-gray-200 pt-4 mt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold text-text-dark font-display">
                    {t('seats.total')}
                  </span>
                  <span className="text-4xl font-bold text-brand-primary font-display">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-8">
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
                className="w-full !rounded-xl !px-6 !py-4 min-h-[4rem] !font-bold !text-lg"
              >
                {t('seats.cta', { seats, total: `$${total.toFixed(2)}` })}
              </CheckoutButton>
            </div>

            {/* Features List */}
            <div className="mt-8 pt-8 border-t border-bg-gray-100">
              <h3 className="text-lg font-bold text-text-dark mb-4 font-display">
                {t('seats.whatsIncluded')}
              </h3>
              <ul className="space-y-3">
                {['photosPerSeat', 'professionalQuality', 'teamManagement', 'fastDelivery', 'support'].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-brand-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-text-body">{t(`seats.features.${feature}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Try It For Free Card */}
          <div className="max-w-2xl mx-auto">
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
