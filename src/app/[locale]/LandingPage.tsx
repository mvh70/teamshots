'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import SampleGallery from '@/components/SampleGallery';
import HeroGallery from '@/components/HeroGallery';
import TrustIndicators from '@/components/TrustIndicators';
import HowItWorks from '@/components/HowItWorks';
import FAQ from '@/components/FAQ';
import PricingPreview from '@/components/PricingPreview';
import { TrackedLink } from '@/components/TrackedLink';
import { prefersReducedMotion, ANIMATION_DELAYS } from '@/lib/animations';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

export default function LandingPage() {
  const t = useTranslations('hero');
  
  // Start visible for LCP optimization - content is immediately visible on first paint
  // Animations are applied via CSS animation classes instead of JS-controlled opacity
  const [heroMounted, setHeroMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Enable animations after hydration - hero is always visible, but entrance animations play once
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    // Tiny delay to ensure first paint happens before animation starts
    const timer = requestAnimationFrame(() => setHeroMounted(true));
    // Check reduced motion preference after hydration to avoid mismatch
    try {
      setReducedMotion(prefersReducedMotion());
    } catch (error) {
      console.error('Error checking reduced motion preference:', error);
    }
    return () => cancelAnimationFrame(timer);
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  return (
    <div className="min-h-screen bg-bg-white relative grain-texture">
      {/* Subtle background with strategic gradient mesh */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-25 -z-10"></div>
      {/* Additional subtle overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-gray-50/30 -z-10"></div>
      
      {/* Hero Section - Asymmetric Layout */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 sm:pb-24 lg:pt-40 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 lg:gap-20 items-center">
          {/* Left Content - 60% (3 columns on desktop) */}
          <div className="lg:col-span-3 text-left relative z-10">
            {/* Hero Title - Large, Bold, Left-aligned */}
            {/* LCP element: No animation - visible immediately for optimal LCP score */}
            <h1 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold text-text-dark mb-8 leading-[1.1] tracking-tight"
            >
              {t('titleMain')}{' '}
              <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary bg-clip-text text-transparent drop-shadow-sm">
                {t('titleHighlightTime')}
              </span>
            </h1>

            {/* Subtitle - Medium, Left-aligned */}
            <p 
              className={`text-xl sm:text-2xl md:text-2xl lg:text-3xl text-text-body mb-10 max-w-2xl leading-[1.4] font-medium ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle}ms` 
              }}
            >
              {t('subtitleMain')}
            </p>

            {/* Supporting Description */}
            <p 
              className={`text-base sm:text-lg lg:text-xl text-text-body mb-12 max-w-xl leading-[1.7] ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ 
                transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 100}ms` 
              }}
            >
              {t('subtitle')}
            </p>

            {/* Primary CTA - Large, Prominent */}
            <div 
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-5 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
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
                className="inline-flex items-center justify-center px-10 py-5 bg-brand-cta text-white font-bold text-lg sm:text-xl rounded-2xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
              >
                {t('joinWaitlist')}
              </TrackedLink>
              <p className="text-sm sm:text-base text-text-muted self-center sm:self-auto">
                {t('noCreditCard')}
              </p>
            </div>
          </div>

          {/* Right Gallery - 40% (2 columns on desktop), Overlaps */}
          <div 
            className={`lg:col-span-2 relative ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-all duration-1000 ease-out`}
            style={{ 
              transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` 
            }}
          >
            {/* Offset gallery slightly for asymmetry */}
            <div className="w-full max-w-lg mx-auto lg:ml-auto lg:mr-0 lg:translate-x-12 lg:translate-y-4">
              <HeroGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section - Hidden for now */}
      {/* <SocialProof /> */}

      {/* Sample Gallery Section */}
      <SampleGallery />

      {/* Trust Indicators */}
      <TrustIndicators />

      {/* How It Works */}
      <HowItWorks />

      {/* Pricing Preview */}
      <PricingPreview />

      {/* FAQ Section */}
      <FAQ />

      {/* Final CTA Section - Before Footer */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-40 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
          {t('finalCtaTitle')}
        </h2>
        <p className="text-lg sm:text-xl lg:text-2xl text-text-body mb-12 max-w-2xl mx-auto leading-relaxed">
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
                className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white font-bold text-xl rounded-2xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
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

