'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import PricingCard from '@/components/pricing/PricingCard'
import { getClientDomain, getSignupTypeFromDomain, getForcedSignupType } from '@/lib/domain'
import { PRICING_CONFIG } from '@/config/pricing'
import { getPricePerPhoto, formatPrice } from '@/domain/pricing/utils'

export default function PricingContent() {
  const t = useTranslations('pricing');

  // Domain-based pricing restriction
  const [domainSignupType, setDomainSignupType] = useState<'individual' | 'team' | null>(null);

  useEffect(() => {
    const domain = getClientDomain();
    const forcedType = getForcedSignupType();
    const signupType = forcedType || getSignupTypeFromDomain(domain);
    setDomainSignupType(signupType);
  }, []);

  const tryOncePlan = {
    id: 'tryOnce' as const,
    price: `$${PRICING_CONFIG.tryOnce.price}`,
    credits: PRICING_CONFIG.tryOnce.credits,
    regenerations: PRICING_CONFIG.regenerations.tryOnce,
    pricePerPhoto: formatPrice(getPricePerPhoto('tryOnce')),
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
    // Always show Try Once
    tryOncePlan,
    // Show Individual if individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? [individualPlan] : []),
    // Show Pro Small and Pro Large if team domain or no domain restriction
    ...(domainSignupType === 'team' || domainSignupType === null ? [proSmallPlan, proLargePlan] : []),
  ]

  return (
    <div className="min-h-screen bg-bg-gray-50 py-20 lg:py-32 relative grain-texture">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
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
          {plansToShow.map((plan) => (
          <PricingCard
              key={plan.id}
              {...plan}
            ctaMode="link"
              href={`/auth/signup?${
                plan.id === 'proSmall' ? 'tier=team&period=proSmall' :
                plan.id === 'proLarge' ? 'tier=team&period=proLarge' :
                plan.id === 'individual' ? 'tier=individual&period=individual' :
                'period=tryOnce'
              }`}
            className="h-full"
          />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-center mb-12 text-text-dark">
            {t('faq.title')}
          </h2>
          <div className="space-y-6">
            {['freeGen', 'howCreditsWork', 'topUp', 'satisfaction'].map((faqKey) => (
              <div key={faqKey} className="bg-bg-white rounded-2xl p-6 lg:p-8 shadow-depth-md hover:shadow-depth-lg transition-all duration-300">
                <h3 className="text-lg lg:text-xl font-bold mb-3 text-text-dark font-display">
                  {t(`faq.questions.${faqKey}.question`)}
                </h3>
                <p className="text-base lg:text-lg text-text-body leading-relaxed">
                  {t(`faq.questions.${faqKey}.answer`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
