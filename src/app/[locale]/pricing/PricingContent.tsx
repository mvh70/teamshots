'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SeatsPricingCard from '@/components/pricing/SeatsPricingCard'
import PricingCard from '@/components/pricing/PricingCard'
import PlanCheckoutSection from '@/components/pricing/PlanCheckoutSection'
import BeforeAfterSlider from '@/components/BeforeAfterSlider'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from '@/domain/pricing/utils'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { LandingVariant } from '@/config/landing-content'

// Before/after sample images for visual proof
const SAMPLE_IMAGES = [
  { before: '/samples/before-4.webp', after: '/samples/after-4.webp' },
  { before: '/samples/before-5.webp', after: '/samples/after-5.webp' },
];

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
  const { track } = useAnalytics();

  // Derive signup type from server-provided variant (no client-side detection)
  const domainSignupType: 'individual' | 'team' | null =
    variant === 'individualshots' ? 'individual' :
    variant === 'teamshotspro' ? 'team' :
    null;

  // Track pricing page view with context
  useEffect(() => {
    track('pricing_page_viewed', {
      variant: variant || 'unknown',
      signup_type: domainSignupType || 'unknown',
    });
  }, [track, variant, domainSignupType]);

  // Seats-based pricing for TeamShotsPro
  if (variant === 'teamshotspro') {
    // Team-specific FAQ keys - includes pricing-specific questions
    const teamFaqKeys = ['refund', 'turnaround', 'requirements', 'consistency', 'addSeatsLater', 'unusedCredits'] as const;

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

          {/* Pricing Section - Lead with what users came for */}
          <div className="max-w-5xl mx-auto mb-16">
            {/* Main Pricing Card - Full width emphasis */}
            <div className="mb-8">
              <SeatsPricingCard unauth={true} />
            </div>

            {/* Free Trial - Subordinate, supporting element */}
            <div className="text-center">
              <p className="text-text-body mb-3">
                {t('seats.freeTrialPrompt')}
              </p>
              <a
                href="/auth/signup"
                className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary-hover font-semibold transition-colors"
              >
                {t('seats.tryFreeLink')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Visual Proof Section - Moved below pricing */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl lg:text-3xl font-display font-bold text-text-dark mb-2">
                {t('seats.visualProof.title')}
              </h2>
              <p className="text-text-body">
                {t('seats.visualProof.subtitle')}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {SAMPLE_IMAGES.map((sample, index) => (
                <div key={index} className="rounded-2xl overflow-hidden shadow-depth-lg">
                  <BeforeAfterSlider
                    beforeSrc={sample.before}
                    afterSrc={sample.after}
                    alt={`Professional headshot transformation example ${index + 1}`}
                    size="md"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee Badge */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 rounded-full px-6 py-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-semibold text-green-800">{t('seats.guarantee')}</span>
            </div>
          </div>

          {/* FAQ Section for Teams */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-12 text-text-dark">
              {t('seats.faq.title')}
            </h2>
            <div className="space-y-6">
              {teamFaqKeys.map((faqKey) => (
                <div key={faqKey} className="bg-bg-white rounded-2xl p-6 lg:p-8 shadow-depth-md hover:shadow-depth-lg transition-all duration-300">
                  <h3 className="text-lg lg:text-xl font-bold mb-3 text-text-dark font-display">
                    {t(`seats.faq.${faqKey}.question`)}
                  </h3>
                  <p className="text-base lg:text-lg text-text-body leading-relaxed">
                    {t(`seats.faq.${faqKey}.answer`)}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Calculate pricing values for FAQ interpolation
  const individualPhotos = calculatePhotosFromCredits(PRICING_CONFIG.individual.credits)
  const individualVariations = 1 + PRICING_CONFIG.regenerations.individual
  const individualTotalPhotos = individualPhotos * individualVariations

  const vipPhotos = calculatePhotosFromCredits(PRICING_CONFIG.vip.credits)
  const vipVariations = 1 + PRICING_CONFIG.regenerations.vip
  const vipTotalPhotos = vipPhotos * vipVariations

  const maxVariations = Math.max(individualVariations, vipVariations)

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
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    popular: domainSignupType === 'individual', // Popular for individual domain
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
    // Always show Try It For Free last
    freePlan,
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
            const originalAmount = plan.id === 'individual'
              ? PRICING_CONFIG.individual.price
              : PRICING_CONFIG.vip.price

            const isPopular = 'popular' in plan && plan.popular

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
                    ctaText={t(`plans.${plan.id}.cta`, { totalPhotos: plan.totalPhotos })}
                    isPopular={isPopular}
                  />
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
                vipPrice: formatPrice(PRICING_CONFIG.vip.price),
                vipPhotos: vipTotalPhotos.toString(),
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
