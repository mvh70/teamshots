'use client';

import { useTranslations } from 'next-intl';
import { getPricingDisplay } from '@/domain/pricing';
import { useState } from 'react';
import PricingCard from '@/components/pricing/PricingCard'

export default function PricingContent() {
  const t = useTranslations('pricing');
  const pricing = getPricingDisplay();
  const [isYearly, setIsYearly] = useState(false);

  const tryOncePlan = {
    id: 'tryOnce' as const,
    price: pricing.tryOnce.price,
    credits: pricing.tryOnce.credits,
    pricePerPhoto: pricing.tryOnce.pricePerPhoto,
    regenerations: pricing.tryOnce.regenerations,
  }

  const individualPlan = {
    id: 'individual' as const,
    price: pricing.individual.monthly.price,
    yearlyPrice: pricing.individual.annual.price,
    credits: pricing.individual.monthly.credits,
    monthlyPricePerPhoto: pricing.individual.monthly.pricePerPhoto,
    yearlyPricePerPhoto: pricing.individual.annual.pricePerPhoto,
    regenerations: pricing.individual.monthly.regenerations,
    annualSavings: pricing.individual.annual.savings,
  }

  const proPlan = {
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
          
          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center justify-center mt-10 mb-8">
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
          </div>
        </div>

        {/* Pricing Cards (using shared component) */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mb-16 overflow-visible">
          <PricingCard
            {...proPlan}
            isYearly={isYearly}
            ctaMode="link"
            href="/auth/signup?tier=team&period=monthly"
            className="h-full"
          />
          <PricingCard
            {...individualPlan}
            isYearly={isYearly}
            ctaMode="link"
            href="/auth/signup?tier=individual&period=monthly"
            className="h-full"
          />
          <PricingCard
            {...tryOncePlan}
            isYearly={false}
            ctaMode="link"
            href="/auth/signup?period=try_once"
            className="h-full"
          />
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
