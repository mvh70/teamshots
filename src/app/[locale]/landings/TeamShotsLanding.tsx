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
import type { LandingVariant, LandingSections } from '@/config/landing-content';
import type { LandingProps } from '../page';

/**
 * TeamShotsPro Landing Page
 * 
 * B2B-focused landing page for HR managers and team leads.
 * Features:
 * - Team management emphasis
 * - Corporate/professional tone
 * - 5-step team workflow
 * - Team Command Center feature highlight
 */
export default function TeamShotsLanding({ supportEmail }: LandingProps) {
  const variant: LandingVariant = 'teamshotspro';
  
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.hero`);
  
  // Animation state
  const [heroMounted, setHeroMounted] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const timer = requestAnimationFrame(() => setHeroMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Section visibility for TeamShots - show all team features
  const showSection = (section: keyof LandingSections): boolean => {
    const visibility: LandingSections = {
      showTeamCommandCenter: true,
      showIndustryTemplates: true,
      showTeamFlow: true,
      showIndividualFlow: false,
    };
    return visibility[section];
  };

  return (
    <div className="min-h-screen bg-bg-white relative grain-texture">
      {/* Subtle background with strategic gradient mesh */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-25 -z-10"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-gray-50/30 -z-10"></div>
      
      {/* Hero Section - Professional B2B Layout */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-24 lg:pb-28">
        
        {/* Full Width Heading Part 1 (Lines 1 & 2) */}
        <div className="text-left mb-2 lg:mb-4">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold text-text-dark leading-[0.9] tracking-tight">
            <span className="block">{t('titleLine1')}</span>
            <span className="block">{t('titleLine2')}</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 xl:gap-18 items-start relative">
          {/* Left Content - 60% */}
          <div className="lg:col-span-8 xl:col-span-8 text-left relative z-10 lg:-mr-8 xl:-mr-16 lg:pr-32 xl:pr-40">
            
            {/* Hero Title Part 2 (Line 3) */}
            <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold mb-6 leading-[0.9] tracking-tight">
              <span className="block bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary bg-clip-text text-transparent">
                {t('titleHighlightTime')}
              </span>
            </div>

            {/* Subtitle */}
            <p 
              className={`text-xl sm:text-2xl md:text-2xl lg:text-3xl text-text-body mb-10 max-w-2xl leading-[1.4] font-medium ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle}ms` }}
            >
              {t('subtitleMain')}
            </p>

            {/* Supporting Description */}
            <p 
              className={`text-base sm:text-lg lg:text-xl text-text-body mb-12 max-w-xl leading-[1.7] ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 100}ms` }}
            >
              {t('subtitle')} {t('subtitleBold')}
            </p>

            {/* Primary CTA */}
            <div 
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-6 ${
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
                className="inline-flex items-center justify-center px-10 py-5 bg-brand-cta text-white font-bold text-lg sm:text-xl rounded-2xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
              >
                {t('cta')}
              </TrackedLink>
              <p className="text-sm sm:text-base text-text-muted self-center sm:self-auto">
                {t('noCreditCard')}
              </p>
            </div>
          </div>

          {/* Right Gallery */}
          <div 
            className={`lg:col-span-4 relative ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-all duration-1000 ease-out`}
            style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` }}
          >
            <div className="w-full max-w-lg mx-auto lg:ml-auto lg:mr-0 lg:absolute lg:top-0 lg:right-4 xl:right-8 lg:translate-x-0">
              <HeroGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery - Team transformation examples */}
      <SampleGallery variant={variant} />

      {/* Trust Indicators - Shows Team Command Center feature */}
      <TrustIndicators variant={variant} showSection={showSection} />

      {/* How It Works - 5-step team workflow */}
      <HowItWorks variant={variant} />

      {/* Pricing Preview */}
      <PricingPreview variant={variant} />

      {/* FAQ Section */}
      <FAQ variant={variant} supportEmail={supportEmail} />

      {/* Final CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-40 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
          {t('finalCtaTitle')}
        </h2>
        <p className="text-lg sm:text-xl lg:text-2xl text-text-body mb-12 max-w-2xl mx-auto leading-relaxed">
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
          className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white font-bold text-xl rounded-2xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
        >
          {t('cta')}
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
