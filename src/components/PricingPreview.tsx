'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  yearlyPrice?: string;
  period: string;
  credits: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  savings?: string;
  yearlySavings?: string;
}

export default function PricingPreview() {
  const t = useTranslations('pricingPreview');
  const [isYearly, setIsYearly] = useState(false);

  const PRICING_PLANS: PricingPlan[] = [
    // Reversed order: Pro → Starter → Try Once
    {
      id: 'pro',
      name: t('plans.pro.name'),
      price: t('plans.pro.price'),
      yearlyPrice: '$600',
      period: t('plans.pro.period'),
      credits: t('plans.pro.credits'),
      description: t('plans.pro.description'),
      features: [
        t('plans.pro.features.0'),
        t('plans.pro.features.1'),
        t('plans.pro.features.2'),
        t('plans.pro.features.3'),
        t('plans.pro.features.4'),
        t('plans.pro.features.5')
      ],
      cta: t('plans.pro.cta'),
      savings: t('plans.pro.savings'),
      yearlySavings: 'Save $108/year'
    },
    {
      id: 'starter',
      name: t('plans.starter.name'),
      price: t('plans.starter.price'),
      yearlyPrice: '$245',
      period: t('plans.starter.period'),
      credits: t('plans.starter.credits'),
      description: t('plans.starter.description'),
      features: [
        t('plans.starter.features.0'),
        t('plans.starter.features.1'),
        t('plans.starter.features.2'),
        t('plans.starter.features.3'),
        t('plans.starter.features.4'),
        t('plans.starter.features.5')
      ],
      cta: t('plans.starter.cta'),
      popular: true,
      savings: t('plans.starter.savings'),
      yearlySavings: 'Save $43/year'
    },
    {
      id: 'tryOnce',
      name: t('plans.tryOnce.name'),
      price: t('plans.tryOnce.price'),
      period: t('plans.tryOnce.period'),
      credits: t('plans.tryOnce.credits'),
      description: t('plans.tryOnce.description'),
      features: [
        t('plans.tryOnce.features.0'),
        t('plans.tryOnce.features.1'),
        t('plans.tryOnce.features.2'),
        t('plans.tryOnce.features.3')
      ],
      cta: t('plans.tryOnce.cta')
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PRICING_PLANS.map((plan) => {
            // Color hierarchy: Gray (basic), Orange (popular/action), Violet (premium)
            const borderColor = plan.id === 'tryOnce' 
              ? 'border-2 border-gray-200' 
              : plan.popular 
                ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring transform scale-105 shadow-brand-cta-shadow' 
                : 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring';
            
            // Dynamic pricing based on toggle
            const displayPrice = isYearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
            const displayPeriod = isYearly && plan.yearlyPrice ? 'per year' : plan.period;
            const displaySavings = isYearly && plan.yearlySavings ? plan.yearlySavings : null;
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg p-6 ${borderColor} transition-all duration-300 hover:shadow-xl flex flex-col h-full`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-brand-cta to-brand-cta-ring text-white px-6 py-2 rounded-full text-base font-bold shadow-lg">
                      {t('mostPopular')}
                    </div>
                  </div>
                )}
              
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {displayPrice}
                    </span>
                    <span className="text-gray-600 ml-1">
                      /{displayPeriod}
                    </span>
                    {displaySavings && (
                      <div className="text-sm text-green-600 font-medium mt-1">
                        {displaySavings}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-brand-primary font-medium mb-1">
                    {plan.credits}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700 text-[16px] leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/#waitlist"
                  className={`block w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 text-center mt-auto ${
                    plan.popular
                      ? 'bg-brand-cta text-white hover:bg-brand-cta-hover shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ Link */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            {t('questions')}
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center text-brand-primary hover:text-brand-primary-hover font-medium"
          >
            {t('viewFullPricing')}
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
