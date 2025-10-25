'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { getPricingDisplay, calculatePhotosFromCredits } from '@/config/pricing';

export default function PricingPreview() {
  const t = useTranslations('pricing');
  const [isYearly, setIsYearly] = useState(false);
  const pricing = getPricingDisplay();

  const plans = [
    // Order: Pro → Individual → Try Once
    {
      id: 'pro',
      price: pricing.pro.monthly.price,
      yearlyPrice: pricing.pro.annual.price,
      credits: pricing.pro.monthly.credits,
      monthlyPricePerPhoto: pricing.pro.monthly.pricePerPhoto,
      yearlyPricePerPhoto: pricing.pro.annual.pricePerPhoto,
      regenerations: pricing.pro.monthly.regenerations,
      annualPrice: pricing.pro.annual.price,
      annualSavings: pricing.pro.annual.savings,
      topUpPrice: pricing.pro.topUp,
      popular: true,
    },
    {
      id: 'individual',
      price: pricing.individual.monthly.price,
      yearlyPrice: pricing.individual.annual.price,
      credits: pricing.individual.monthly.credits,
      monthlyPricePerPhoto: pricing.individual.monthly.pricePerPhoto,
      yearlyPricePerPhoto: pricing.individual.annual.pricePerPhoto,
      regenerations: pricing.individual.monthly.regenerations,
      annualPrice: pricing.individual.annual.price,
      annualSavings: pricing.individual.annual.savings,
      topUpPrice: pricing.individual.topUp,
      popular: false,
    },
    {
      id: 'tryOnce',
      price: pricing.tryOnce.price,
      credits: pricing.tryOnce.credits,
      pricePerPhoto: pricing.tryOnce.pricePerPhoto,
      regenerations: pricing.tryOnce.regenerations,
      popular: false,
    },
  ] as const;

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
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  !isYearly
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const planT = (key: string) => t(`plans.${plan.id}.${key}`);
            const rawFeatures = t.raw(`plans.${plan.id}.features`) as string[];
            
            // Calculate number of photos from credits
            const numberOfPhotos = calculatePhotosFromCredits(plan.credits);
            
            // Replace placeholders with actual values from config
            const features = rawFeatures.map(feature => 
              feature
                .replace('{regenerations}', plan.regenerations?.toString() || '2')
                .replace('{photos}', numberOfPhotos.toString())
            );
            
            // Use original features without adding calculated photos
            const featuresWithPhotos = features;
            
            // Dynamic pricing based on toggle
            // For yearly, show monthly equivalent (yearly price / 12) since we bill monthly
            const displayPrice = isYearly && 'yearlyPrice' in plan && plan.yearlyPrice 
              ? `$${(parseFloat(plan.yearlyPrice.replace('$', '')) / 12).toFixed(2)}` 
              : plan.price;
            // For subscription plans (Individual/Pro), always show "monthly" since we bill monthly
            const displayPeriod = plan.id === 'tryOnce' 
              ? planT('period') 
              : 'monthly';
            const displayCredits = plan.credits;
            const displaySavings = isYearly && 'annualSavings' in plan && plan.annualSavings ? `Save ${plan.annualSavings}/year` : null;
            
            // Dynamic price per photo based on toggle
            const displayPricePerPhoto = plan.id === 'tryOnce' 
              ? plan.pricePerPhoto 
              : isYearly && 'yearlyPricePerPhoto' in plan 
                ? plan.yearlyPricePerPhoto 
                : plan.monthlyPricePerPhoto;
            
            // Color hierarchy: Gray (basic), Orange (popular/action), Violet (premium)
            const borderColor = plan.id === 'tryOnce' 
              ? 'border-2 border-gray-200' 
              : plan.id === 'individual'
                ? 'border-2 border-gray-200'
                : plan.popular 
                  ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring scale-105 shadow-brand-cta-shadow' 
                  : 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring';
            
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
                    {planT('name')}
                  </h3>
                  <p className="text-gray-600 mb-4">{planT('description')}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {displayPrice}
                    </span>
                    <span className="text-gray-600">{displayPeriod}</span>
                    {displaySavings && (
                      <span className="ml-3 relative inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg transform hover:scale-105 transition-all duration-200 animate-bounce">
                        <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {displaySavings}
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-brand-primary font-semibold mt-2">
                    {displayCredits} {plan.id === 'tryOnce' ? t('credits') : t('creditsPerMonth')}
                  </p>
                  
                  {/* Price per photo callout */}
                  <div className="mt-4 relative group">
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 rounded-2xl p-1 shadow-2xl transform hover:scale-105 hover:shadow-emerald-500/25 transition-all duration-300">
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 relative">
                            <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-bounce shadow-lg"></div>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-gray-900">
                                {displayPricePerPhoto}
                              </span>
                              <span className="text-xs font-semibold text-gray-600">per photo</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {plan.regenerations} variations
                              </span>
                              <span className="text-xs text-gray-500">included</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {featuresWithPhotos.map((feature) => {
                    const isHeader = feature.includes('plus:') || feature.includes('más:');
                    return (
                      <li key={feature} className="flex items-start gap-3">
                        {!isHeader && (
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
                        )}
                        {isHeader && <div className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <span 
                  className={`text-gray-700 ${isHeader ? 'font-semibold text-gray-800' : ''}`}
                  dangerouslySetInnerHTML={{ __html: feature }}
                />
                      </li>
                    );
                  })}
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
      </div>
    </section>
  );
}