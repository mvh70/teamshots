'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PricingCard from '@/components/pricing/PricingCard'
import { CheckoutButton } from '@/components/ui'
import { getClientDomain, getSignupTypeFromDomain, getForcedSignupType } from '@/lib/domain'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice } from '@/domain/pricing/utils'

export default function PricingContent() {
  const t = useTranslations('pricing');

  // Domain-based pricing restriction - compute from domain detection functions.
  // These functions access browser APIs (window.location) so must run client-side.
  const [domainSignupType] = useState<'individual' | 'team' | null>(() => {
    if (typeof window === 'undefined') return null
    const domain = getClientDomain()
    const forcedType = getForcedSignupType()
    return forcedType || getSignupTypeFromDomain(domain)
  })

  const tryItForFreePlan = {
    id: 'tryItForFree' as const,
    price: 'Free',
    credits: PRICING_CONFIG.tryItForFree.credits,
    regenerations: PRICING_CONFIG.regenerations.tryItForFree,
    pricePerPhoto: formatPrice(getPricePerPhoto('tryItForFree')),
  }

  const individualPlan = {
    id: 'individual' as const,
    price: `$${PRICING_CONFIG.individual.price}`,
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
  }

  const proSmallPlan = {
    id: 'proSmall' as const,
    price: `$${PRICING_CONFIG.proSmall.price}`,
    credits: PRICING_CONFIG.proSmall.credits,
    regenerations: PRICING_CONFIG.regenerations.proSmall,
    popular: domainSignupType === 'team' || domainSignupType === null, // Popular only when team-restricted or no restriction
    pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
  }

  const proLargePlan = {
    id: 'proLarge' as const,
    price: `$${PRICING_CONFIG.proLarge.price}`,
    credits: PRICING_CONFIG.proLarge.credits,
    regenerations: PRICING_CONFIG.regenerations.proLarge,
    pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
  }

  // Filter plans based on domain restrictions
  const plansToShow = [
    // Always show Try It For Free first
    tryItForFreePlan,
    // Show Individual if individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? [individualPlan] : []),
    // Show Pro Small and Pro Large if team domain or no domain restriction
    ...(domainSignupType === 'team' || domainSignupType === null ? [proSmallPlan, proLargePlan] : []),
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
        <div className={`grid gap-8 lg:gap-10 mb-16 overflow-visible ${
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
                : PRICING_CONFIG.proLarge.stripePriceId
            
            const planTier = plan.id === 'individual' ? 'individual' : 'pro'
            const planPeriod = plan.id === 'proLarge' ? 'large' : 'small'
            
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
                    useBrandCtaColors={'popular' in plan && plan.popular}
                    className={'popular' in plan && plan.popular 
                      ? '' 
                      : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary border-2 border-transparent hover:border-brand-primary-lighter/50'
                    }
                  >
                    {t(`plans.${plan.id}.cta`)}
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
              // Get domain-specific answer key
              const getAnswerKey = (baseKey: string) => {
                if (domainSignupType === 'team') {
                  return `${baseKey}Team`;
                } else if (domainSignupType === 'individual') {
                  return `${baseKey}Individual`;
                }
                return baseKey;
              };
              
              const answerKey = getAnswerKey('answer');
              return (
                <div key={faqKey} className="bg-bg-white rounded-2xl p-6 lg:p-8 shadow-depth-md hover:shadow-depth-lg transition-all duration-300">
                  <h3 className="text-lg lg:text-xl font-bold mb-3 text-text-dark font-display">
                    {t(`faq.questions.${faqKey}.question`)}
                  </h3>
                  <p className="text-base lg:text-lg text-text-body leading-relaxed">
                    {t(`faq.questions.${faqKey}.${answerKey}`)}
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
