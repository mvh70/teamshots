import { useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import Link from 'next/link';
import { getPricingDisplay } from '@/config/pricing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function PricingPage() {
  const t = useTranslations('pricing');
  const pricing = getPricingDisplay();

  const plans = [
    {
      id: 'tryOnce',
      price: pricing.tryOnce.price,
      credits: pricing.tryOnce.credits,
      generations: pricing.tryOnce.generations,
      popular: false,
    },
    {
      id: 'starter',
      price: pricing.starter.monthly.price,
      credits: pricing.starter.monthly.credits,
      generations: pricing.starter.monthly.generations,
      annualPrice: pricing.starter.annual.price,
      annualSavings: pricing.starter.annual.savings,
      topUpPrice: pricing.starter.topUp,
      popular: true,
    },
    {
      id: 'pro',
      price: pricing.pro.monthly.price,
      credits: pricing.pro.monthly.credits,
      generations: pricing.pro.monthly.generations,
      annualPrice: pricing.pro.annual.price,
      annualSavings: pricing.pro.annual.savings,
      topUpPrice: pricing.pro.topUp,
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
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const planT = (key: string) => t(`plans.${plan.id}.${key}`);
            const features = t.raw(`plans.${plan.id}.features`) as string[];
            
            // Color hierarchy: Gray (basic), Orange (popular/action), Violet (premium)
            const borderColor = plan.id === 'tryOnce' 
              ? 'border-2 border-gray-200' 
              : plan.popular 
                ? 'ring-3 ring-brand-cta-ring border-2 border-brand-cta-ring scale-105 shadow-brand-cta-shadow' 
                : 'ring-2 ring-brand-premium-ring border-2 border-brand-premium-ring';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg p-8 ${borderColor} transition-all duration-300 hover:shadow-xl`}
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
                      {plan.price}
                    </span>
                    <span className="text-gray-600">{planT('period')}</span>
                  </div>
                  <p className="text-sm text-brand-primary font-semibold mt-2">
                    {plan.credits} {t('creditsPerMonth')} ({plan.generations} {t('generations')})
                  </p>
                  {plan.id !== 'tryOnce' && 'annualPrice' in plan && (
                    <p className="text-sm text-gray-600 mt-1">
                      {plan.annualPrice}/{t('year')} • {t('save')} {plan.annualSavings}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
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
                  className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
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

