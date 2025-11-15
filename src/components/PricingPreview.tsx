'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { getPricingDisplay } from '@/domain/pricing';
import PricingCard from '@/components/pricing/PricingCard'

export default function PricingPreview() {
  const t = useTranslations('pricing');
  const [isYearly, setIsYearly] = useState(false);
  const pricing = getPricingDisplay();

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

  const tryOncePlan = {
    id: 'tryOnce' as const,
    price: pricing.tryOnce.price,
    credits: pricing.tryOnce.credits,
    pricePerPhoto: pricing.tryOnce.pricePerPhoto,
    regenerations: pricing.tryOnce.regenerations,
  }

  return (
    <section className="py-20 lg:py-32 bg-bg-gray-50 relative grain-texture">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
            {t('title')}
          </h2>
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

        {/* Pricing Cards (shared) */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 overflow-visible">
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
      </div>
    </section>
  );
}