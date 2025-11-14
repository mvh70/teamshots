import { useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import SampleGallery from '@/components/SampleGallery';
import HeroGallery from '@/components/HeroGallery';
import TrustIndicators from '@/components/TrustIndicators';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import FAQ from '@/components/FAQ';
import PricingPreview from '@/components/PricingPreview';
import { TrackedLink } from '@/components/TrackedLink';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function LandingPage() {
  const t = useTranslations('hero');
  const tFeatures = useTranslations('features');

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-primary-light via-white to-gray-50">
      {/* Hero Section with Gradient Background */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Subtle gradient background for visual depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light opacity-60 -z-10"></div>
        
        <div className="text-center relative z-10">

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4">
            {t('title')}{' '}
            <span className="bg-gradient-to-r from-brand-primary to-brand-primary-hover bg-clip-text text-transparent">{t('titleHighlight')}</span>
          </h1>

          {/* Urgency Badge - Time-based pain */}
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-orange-50 text-orange-700 border border-orange-200">
              <span className="w-1.5 h-1.5 bg-brand-cta rounded-full mr-2"></span>
              {t('urgency')}
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-bold text-brand-cta mb-4">
            {t('instantTransformation')}
          </div>
          <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
          

          {/* Social Proof Snippet - Above Mobile CTA */}
          <div className="mb-6 md:hidden max-w-md mx-auto">
            <div className="flex items-center justify-center mb-2">
              <div className="flex text-yellow-400 text-sm">
                ★★★★★
              </div>
            </div>
            <p className="text-sm text-gray-700 italic mb-2 px-4">
              &quot;{t('testimonial.quote')}&quot;
            </p>
            <p className="text-xs text-gray-600">
              {t('testimonial.author')}
            </p>
          </div>

          {/* Mobile-First CTA - Visible Above Fold (Mobile Only) */}
          <div className="mb-12 md:hidden flex flex-col items-center">
            <TrackedLink
              href="/auth/signup"
              aria-label={t('freeCtaAria')}
              event="cta_clicked"
              eventProperties={{
                placement: 'landing_hero_mobile',
                action: 'signup',
              }}
              className="w-full inline-block px-8 py-4 bg-brand-cta text-white font-semibold rounded-lg hover:bg-brand-cta-hover transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-center text-lg"
            >
              {t('joinWaitlist')}
            </TrackedLink>
            <p className="mt-3 text-sm text-gray-600 text-center max-w-md font-medium">
              {t('freeCtaSubtext')}
            </p>
            <p className="mt-1 text-xs text-gray-500 text-center max-w-md">
              {t('noCreditCard')}
            </p>
            {/* Urgency + Scarcity - Mobile */}
            <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg max-w-md">
              <p className="text-xs text-red-700 text-center font-medium">
                ⏰ Limited beta spots remaining
              </p>
            </div>
            {/* Price Anchor - Mobile */}
            <p className="mt-2 text-xs text-gray-500 text-center max-w-md">
              {t('priceComparison.prefix')} <span className="line-through text-gray-400">{t('priceComparison.oldPrice')}</span> {t('priceComparison.arrow')} {t('priceComparison.suffix')} <span className="font-semibold text-brand-cta">{t('priceComparison.newPrice')}</span>
            </p>
          </div>

          {/* Removed redundant guarantee paragraph under hero; trust cluster below covers it */}
        </div>

        {/* Hero Gallery - Interactive Before/After Demo */}
        <div className="mt-16">
          <HeroGallery />
          
          {/* Social Proof Snippet - Above Desktop CTA */}
          <div className="mt-8 mb-6 hidden md:block max-w-lg mx-auto">
            <div className="flex items-center justify-center mb-2">
              <div className="flex text-yellow-400 text-sm">
                ★★★★★
              </div>
            </div>
            <p className="text-sm text-gray-700 italic mb-2">
              &quot;{t('testimonial.quote')}&quot;
            </p>
            <p className="text-xs text-gray-600 text-center">
              {t('testimonial.author')}
            </p>
          </div>

          {/* Single CTA with Urgency - Desktop */}
          <div className="mt-8 hidden md:block text-center">
              <TrackedLink
                href="/auth/signup"
                aria-label={t('freeCtaAria')}
                event="cta_clicked"
                eventProperties={{
                  placement: 'landing_hero_desktop',
                  action: 'signup',
                }}
              className="inline-block px-12 py-5 bg-brand-cta text-white font-semibold rounded-lg hover:bg-brand-cta-hover transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xl"
              >
                {t('joinWaitlist')}
              </TrackedLink>
            <p className="mt-4 text-base text-gray-600 max-w-md mx-auto font-medium">
              {t('freeCtaSubtext')}
            </p>
            {/* Urgency + Scarcity - Desktop */}
            <div className="mt-4 px-6 py-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-red-700 font-medium">
                ⏰ Limited beta access - only 100 spots left
              </p>
            </div>
            {/* Trust Signals Cluster */}
            <div className="mt-4 flex flex-col items-center space-y-1">
              <p className="text-xs text-gray-500">
              {t('noCreditCard')}
            </p>
              <p className="text-xs text-gray-500">
              {t('priceComparison.prefix')} <span className="line-through text-gray-400">{t('priceComparison.oldPrice')}</span> {t('priceComparison.arrow')} {t('priceComparison.suffix')} <span className="font-semibold text-brand-cta">{t('priceComparison.newPrice')}</span>
            </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery Section */}
      <SampleGallery />

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900">{tFeatures('title')}</h2>
        <p className="mt-3 text-lg text-center text-gray-600 max-w-3xl mx-auto">{tFeatures('subtitle')}</p>
        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {/* Speed */}
          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('fast.title')}</h3>
            <p className="text-gray-700 text-base leading-relaxed">
              {tFeatures('fast.description')}
            </p>
          </div>

          {/* Consistency */}
          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M4 7l2 12h12l2-12M7 7l2-3h6l2 3" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('consistency.title')}</h3>
            <p className="text-gray-700 text-base leading-relaxed">
              {tFeatures('consistency.description')}
            </p>
          </div>

          {/* Control */}
          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('control.title')}</h3>
            <p className="text-gray-700 text-base leading-relaxed">
              {tFeatures('control.description')}
            </p>
          </div>

          {/* Cost */}
          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('costEffective.title')}</h3>
            <p className="text-gray-700 text-base leading-relaxed">
              {tFeatures('costEffective.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <TrustIndicators />

      {/* Social Proof */}
      <SocialProof />

      {/* How It Works */}
      <HowItWorks />

      {/* FAQ Section */}
      <FAQ />

      {/* Pricing Preview */}
      <PricingPreview />

    </div>
  );
}

