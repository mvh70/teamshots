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
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
          
          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  !isYearly
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  isYearly
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards (using shared component) */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
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
          <h2 className="text-3xl font-bold text-center mb-8">
            {t('faq.title')}
          </h2>
          <div className="space-y-6">
            {['freeGen', 'howCreditsWork', 'topUp', 'satisfaction'].map((faqKey) => (
              <div key={faqKey} className="bg-white rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {t(`faq.questions.${faqKey}.question`)}
                </h3>
                <p className="text-gray-600">
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
