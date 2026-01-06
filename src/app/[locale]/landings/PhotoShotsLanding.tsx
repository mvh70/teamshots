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
import { CreditCardIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { LandingVariant, LandingSections } from '@/config/landing-content';
import type { LandingProps } from '../page';

/**
 * PhotoShotsPro Landing Page
 * 
 * Individual-focused landing page for personal headshots.
 * Features:
 * - Personal branding emphasis
 * - Friendly, approachable tone
 * - 3-step simple workflow
 * - Focus on LinkedIn, dating profiles, personal branding
 */
export default function PhotoShotsLanding({ supportEmail }: LandingProps) {
  const variant: LandingVariant = 'photoshotspro';
  
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.hero`);
  
  // Animation state
  const [heroMounted, setHeroMounted] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const timer = requestAnimationFrame(() => setHeroMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Section visibility for PhotoShots - hide team features, show individual features
  const showSection = (section: keyof LandingSections): boolean => {
    const visibility: LandingSections = {
      showTeamCommandCenter: false,  // Hide team management
      showIndustryTemplates: true,   // Show individual style options
      showTeamFlow: false,           // Hide team workflow
      showIndividualFlow: true,      // Show simple 3-step flow
    };
    return visibility[section];
  };

  return (
    <div className="min-h-screen bg-bg-white relative grain-texture">
      {/* Warmer, friendlier background gradient */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30 -z-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light/10 via-transparent to-bg-gray-50/40 -z-10"></div>
      
      {/* Hero Section - Centered, Friendly Layout */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 sm:pb-24 lg:pt-36 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content - Personal, Approachable */}
          <div className="text-left relative z-10">
            {/* Friendly Badge */}
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 bg-brand-primary-light rounded-full mb-8 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-500 ease-out`}
            >
              <span className="text-2xl">✨</span>
              <span className="text-sm font-medium text-brand-primary">{t('badge')}</span>
            </div>

            {/* Hero Title - Warm and Personal */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-text-dark mb-6 leading-[1.15] tracking-tight">
              {t('titleMain')}{' '}
              <span className="bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary bg-clip-text text-transparent">
                {t('titleHighlightTime')}
              </span>
            </h1>

            {/* Subtitle - Conversational */}
            <p 
              className={`text-lg sm:text-xl lg:text-2xl text-text-body mb-8 max-w-xl leading-relaxed ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle}ms` }}
            >
              {t('subtitleMain')}
            </p>

            {/* Supporting Description */}
            <p 
              className={`text-base sm:text-lg text-text-body mb-10 max-w-lg leading-relaxed ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 100}ms` }}
            >
              {t('subtitle')}
              <strong className="text-text-dark">{t('subtitleBold')}</strong>
            </p>

            {/* Primary CTA - Friendly, Inviting */}
            <div
              className={`flex flex-col items-start gap-4 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.cta}ms` }}
            >
              <TrackedLink
                href="/auth/signup"
                aria-label={t('ctaAria')}
                event="cta_clicked"
                eventProperties={{
                  placement: 'landing_hero_primary',
                  action: 'signup',
                  variant,
                }}
                className="inline-flex items-center justify-center px-8 py-4 bg-brand-cta text-white font-bold text-lg rounded-full hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
              >
                {t('cta')} →
              </TrackedLink>
              <div className="flex flex-col gap-1.5 text-sm text-text-muted">
                <p className="flex items-center gap-2">
                  <CreditCardIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('noCreditCardLine')}</span>
                </p>
                <p className="flex items-center gap-2">
                  <PhotoIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('freeGenerationsLine')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Gallery - Larger, More Prominent */}
          <div 
            className={`relative ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-all duration-1000 ease-out`}
            style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` }}
          >
            <div className="w-full max-w-md mx-auto">
              <HeroGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery - Personal transformation examples */}
      <SampleGallery variant={variant} />

      {/* Trust Indicators - Individual-focused (no Team Command Center) */}
      <TrustIndicators variant={variant} showSection={showSection} />

      {/* How It Works - Simple 3-step individual workflow */}
      <HowItWorks variant={variant} />

      {/* Pricing Preview */}
      <PricingPreview variant={variant} />

      {/* FAQ Section */}
      <FAQ variant={variant} supportEmail={supportEmail} />

      {/* Final CTA Section - Personal, Encouraging */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32 text-center">
        <div className="text-5xl mb-6">📸</div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6 leading-tight">
          {t('finalCtaTitle')}
        </h2>
        <p className="text-lg sm:text-xl text-text-body mb-10 max-w-xl mx-auto leading-relaxed">
          {t('finalCtaSubtitle')}
        </p>
        <TrackedLink
          href="/auth/signup"
          aria-label={t('ctaAria')}
          event="cta_clicked"
          eventProperties={{
            placement: 'landing_final_cta',
            action: 'signup',
            variant,
          }}
          className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white font-bold text-xl rounded-full hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
        >
          {t('cta')} →
        </TrackedLink>
        <div className="mt-4 flex flex-col items-center gap-1.5 text-sm text-text-muted">
          <p className="flex items-center gap-2">
            <CreditCardIcon className="w-4 h-4 flex-shrink-0" />
            <span>{t('noCreditCardLine')}</span>
          </p>
          <p className="flex items-center gap-2">
            <PhotoIcon className="w-4 h-4 flex-shrink-0" />
            <span>{t('freeGenerationsLine')}</span>
          </p>
        </div>
      </section>

      {/* Feedback Button */}
      <FeedbackButton context="landing" />
    </div>
  );
}

