'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getPricingDisplay } from '@/config/pricing';
import { useState } from 'react';

export default function PricingContent() {
  const t = useTranslations('pricing');
  const pricing = getPricingDisplay();
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    // Reversed order: Pro → Starter → Try Once
    {
      id: 'pro',
      price: pricing.pro.monthly.price,
      yearlyPrice: pricing.pro.annual.price,
      credits: pricing.pro.monthly.credits,
      generations: pricing.pro.monthly.generations,
      annualPrice: pricing.pro.annual.price,
      annualSavings: pricing.pro.annual.savings,
      topUpPrice: pricing.pro.topUp,
      popular: false,
    },
    {
      id: 'starter',
      price: pricing.starter.monthly.price,
      yearlyPrice: pricing.starter.annual.price,
      credits: pricing.starter.monthly.credits,
      generations: pricing.starter.monthly.generations,
      annualPrice: pricing.starter.annual.price,
      annualSavings: pricing.starter.annual.savings,
      topUpPrice: pricing.starter.topUp,
      popular: true,
    },
    {
      id: 'tryOnce',
      price: pricing.tryOnce.price,
      credits: pricing.tryOnce.credits,
      generations: pricing.tryOnce.generations,
      popular: false,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
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
                <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                  Save up to $108
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const planT = (key: string) => t(`plans.${plan.id}.${key}`);
            const features = t.raw(`plans.${plan.id}.features`) as string[];
            
            // Dynamic pricing based on toggle
            const displayPrice = isYearly && 'yearlyPrice' in plan && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
            const displayPeriod = isYearly && 'yearlyPrice' in plan && plan.yearlyPrice ? 'per year' : planT('period');
            const displayCredits = plan.credits;
            const displayGenerations = plan.generations;
            const displaySavings = isYearly && 'annualSavings' in plan && plan.annualSavings ? `Save ${plan.annualSavings}` : null;
            
            // Color hierarchy: Gray (basic), Orange (popular/action), Violet (premium)
            const borderColor = plan.id === 'tryOnce' 
              ? 'border-2 border-gray-200' 
              : plan.popular 
                ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring scale-105 shadow-brand-cta-shadow' 
                : 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg p-8 ${borderColor} transition-all duration-300 hover:shadow-xl flex flex-col h-full`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-6 transform -translate-y-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-brand-cta text-white shadow-lg">
                      {t('mostPopular')}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {planT('name')}
                  </h3>
                  <p className="text-gray-600 mb-4">{planT('description')}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      {displayPrice}
                    </span>
                    <span className="text-gray-600">{displayPeriod}</span>
                  </div>
                  {displaySavings && (
                    <div className="text-sm text-green-600 font-medium mt-1">
                      {displaySavings}
                    </div>
                  )}
                  <p className="text-sm text-brand-primary font-semibold mt-2">
                    {displayCredits} {t('creditsPerMonth')} ({displayGenerations} {t('generations')})
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/#waitlist"
                  className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 mt-auto ${
                    plan.popular
                      ? "bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {planT('cta')}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            {t('faq.title')}
          </h2>
          <div className="space-y-6">
            {['howCreditsWork', 'topUp', 'satisfaction'].map((faqKey) => (
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
