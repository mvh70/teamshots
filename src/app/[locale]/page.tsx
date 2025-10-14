import { useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import Link from 'next/link';
import WaitlistForm from './components/WaitlistForm';
import SampleGallery from '@/components/SampleGallery';
import HeroGallery from '@/components/HeroGallery';
import TrustIndicators from '@/components/TrustIndicators';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import FAQ from '@/components/FAQ';
import PricingPreview from '@/components/PricingPreview';

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
          {/* Urgency Banner - Enhanced with bold orange */}
          <div className="inline-flex items-center bg-brand-cta text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-md">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
            {t('urgency')}
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6">
            {t('title')}{' '}
            <span className="bg-gradient-to-r from-brand-primary to-brand-primary-hover bg-clip-text text-transparent">{t('titleHighlight')}</span>
          </h1>
          <p className="text-[22px] text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
          
          <div className="flex gap-4 justify-center mb-6">
            <a
              href="#waitlist"
              className="rounded-lg bg-brand-cta text-white px-8 py-4 font-semibold text-[18px] hover:bg-brand-cta-hover transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {t('joinWaitlist')}
            </a>
          </div>

          {/* Guarantee */}
          <p className="text-base text-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('guarantee')}
          </p>
        </div>

        {/* Hero Gallery - Interactive Before/After Demo */}
        <div className="mt-16">
          <HeroGallery />
        </div>
      </section>

      {/* Sample Gallery Section */}
      <SampleGallery />

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{tFeatures('title')}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('fast.title')}</h3>
            <p className="text-gray-700 text-[15px] leading-relaxed">
              {tFeatures('fast.description')}
            </p>
          </div>

          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('costEffective.title')}</h3>
            <p className="text-gray-700 text-[15px] leading-relaxed">
              {tFeatures('costEffective.description')}
            </p>
          </div>

          <div className="p-6 bg-brand-primary-light rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <div className="w-16 h-16 bg-brand-primary-lighter rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{tFeatures('remote.title')}</h3>
            <p className="text-gray-700 text-[15px] leading-relaxed">
              {tFeatures('remote.description')}
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

      {/* CTA Section */}
      <WaitlistForm />
    </div>
  );
}

