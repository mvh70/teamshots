'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import SampleGallery from '@/components/SampleGallery';
import HeroGallery from '@/components/HeroGallery';
import TrustIndicators from '@/components/TrustIndicators';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import FAQ from '@/components/FAQ';
import PricingPreview from '@/components/PricingPreview';
import { TrackedLink } from '@/components/TrackedLink';
import { prefersReducedMotion, ANIMATION_DELAYS } from '@/lib/animations';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

export default function LandingPage() {
  const t = useTranslations('hero');
  const tFeatures = useTranslations('features');
  const [heroVisible, setHeroVisible] = useState(false);
  const [reducedMotion] = useState(() => {
    // Safely check for reduced motion preference
    try {
      return prefersReducedMotion();
    } catch (error) {
      console.error('Error checking reduced motion preference:', error);
      return false;
    }
  });

  useEffect(() => {
    // Trigger hero animations on mount
    try {
      if (!reducedMotion) {
        setHeroVisible(true);
      } else {
        setHeroVisible(true); // Show immediately if reduced motion
      }
    } catch (error) {
      console.error('Error setting hero visibility:', error);
      // Fallback: show content immediately
      setHeroVisible(true);
    }
  }, [reducedMotion]);

  return (
    <div className="min-h-screen bg-bg-white relative grain-texture">
      {/* Subtle background with strategic gradient mesh */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-20 -z-10"></div>
      
      {/* Hero Section - Asymmetric Layout */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 lg:pt-32 lg:pb-40">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          {/* Left Content - 60% (3 columns on desktop) */}
          <div className="lg:col-span-3 text-left relative z-10">
            {/* Hero Title - Large, Bold, Left-aligned */}
            <h1 
              className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black text-text-dark mb-6 leading-[1.1] tracking-tight ${
                heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.title}ms` 
              }}
            >
              {t('titleMain')}{' '}
              <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary bg-clip-text text-transparent">
                {t('titleHighlightTime')}
              </span>
            </h1>

            {/* Subtitle - Medium, Left-aligned */}
            <p 
              className={`text-xl sm:text-2xl md:text-2xl text-text-body mb-8 max-w-2xl leading-relaxed ${
                heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle}ms` 
              }}
            >
              {t('subtitleMain')}
            </p>

            {/* Supporting Description */}
            <p 
              className={`text-lg text-text-body mb-10 max-w-xl leading-relaxed ${
                heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 100}ms` 
              }}
            >
              {t('subtitle')}
            </p>

            {/* Primary CTA - Large, Prominent */}
            <div 
              className={`flex flex-col sm:flex-row gap-4 ${
                heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.cta}ms` 
              }}
            >
              <TrackedLink
                href="/auth/signup"
                aria-label={t('freeCtaAria')}
                event="cta_clicked"
                eventProperties={{
                  placement: 'landing_hero_primary',
                  action: 'signup',
                }}
                className="inline-flex items-center justify-center px-8 py-4 bg-brand-cta text-white font-bold text-lg rounded-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-lg hover:shadow-depth-xl transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2"
              >
                {t('joinWaitlist')}
              </TrackedLink>
              <p className="text-sm text-text-muted self-center">
                {t('noCreditCard')}
              </p>
            </div>
          </div>

          {/* Right Gallery - 40% (2 columns on desktop), Overlaps */}
          <div 
            className={`lg:col-span-2 relative ${
              heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-all duration-1000 ease-out`}
            style={{ 
              transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` 
            }}
          >
            {/* Offset gallery slightly for asymmetry */}
            <div className="w-full max-w-lg mx-auto lg:ml-auto lg:mr-0 lg:translate-x-8">
              <HeroGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section - Dedicated */}
      <SocialProof />

      {/* Sample Gallery Section */}
      <SampleGallery />

      {/* Features Section - Refined */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 bg-bg-gray-50">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
            {tFeatures('sectionTitle')}
          </h2>
          <p className="text-xl text-text-body max-w-3xl mx-auto leading-relaxed">
            {tFeatures('sectionSubtitle')}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
          {/* Speed */}
          <div className="group p-8 lg:p-10 bg-bg-white rounded-3xl shadow-depth-md border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2 transition-all duration-500">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-sm group-hover:shadow-depth-md">
              <svg className="w-8 h-8 lg:w-10 lg:h-10 text-brand-primary group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold mb-4 text-text-dark font-display">{tFeatures('fast.title')}</h3>
            <p className="text-text-body text-base lg:text-lg leading-relaxed">
              {tFeatures('fast.description')}
            </p>
          </div>

          {/* Consistency */}
          <div className="group p-8 lg:p-10 bg-bg-white rounded-3xl shadow-depth-md border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2 transition-all duration-500">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-sm group-hover:shadow-depth-md">
              <svg className="w-8 h-8 lg:w-10 lg:h-10 text-brand-primary group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M4 7l2 12h12l2-12M7 7l2-3h6l2 3" />
              </svg>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold mb-4 text-text-dark font-display">{tFeatures('consistency.title')}</h3>
            <p className="text-text-body text-base lg:text-lg leading-relaxed">
              {tFeatures('consistency.description')}
            </p>
          </div>

          {/* Control */}
          <div className="group p-8 lg:p-10 bg-bg-white rounded-3xl shadow-depth-md border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2 transition-all duration-500">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-sm group-hover:shadow-depth-md">
              <svg className="w-8 h-8 lg:w-10 lg:h-10 text-brand-primary group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold mb-4 text-text-dark font-display">{tFeatures('control.title')}</h3>
            <p className="text-text-body text-base lg:text-lg leading-relaxed">
              {tFeatures('control.description')}
            </p>
          </div>

          {/* Cost */}
          <div className="group p-8 lg:p-10 bg-bg-white rounded-3xl shadow-depth-md border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2 transition-all duration-500">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-sm group-hover:shadow-depth-md">
              <svg className="w-8 h-8 lg:w-10 lg:h-10 text-brand-primary group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold mb-4 text-text-dark font-display">{tFeatures('costEffective.title')}</h3>
            <p className="text-text-body text-base lg:text-lg leading-relaxed">
              {tFeatures('costEffective.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <TrustIndicators />

      {/* How It Works */}
      <HowItWorks />

      {/* FAQ Section */}
      <FAQ />

      {/* Pricing Preview */}
      <PricingPreview />

      {/* Final CTA Section - Before Footer */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
          {t('finalCtaTitle')}
        </h2>
        <p className="text-xl text-text-body mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('finalCtaSubtitle')}
        </p>
        <TrackedLink
          href="/auth/signup"
          aria-label={t('freeCtaAria')}
          event="cta_clicked"
          eventProperties={{
            placement: 'landing_final_cta',
            action: 'signup',
          }}
          className="inline-flex items-center justify-center px-10 py-5 bg-brand-cta text-white font-bold text-xl rounded-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-cta focus:ring-offset-2"
        >
          {t('joinWaitlist')}
        </TrackedLink>
        <p className="mt-4 text-sm text-text-muted">
          {t('noCreditCard')}
        </p>
      </section>

      {/* Feedback Button */}
      <FeedbackButton context="landing" />

    </div>
  );
}

