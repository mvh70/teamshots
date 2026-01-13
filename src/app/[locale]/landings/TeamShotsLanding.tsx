'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import Image from 'next/image';
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
      <section className="relative max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 pt-8 sm:pt-10 lg:pt-12 pb-8 sm:pb-10 lg:pb-12">

        {/* Full Width Heading Part 1 (Lines 1 & 2) */}
        <div className="text-left mb-0 lg:mb-1">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-text-dark leading-[0.9] tracking-tight">
            <span className="block">{t('titleLine1')}</span>
            <span className="block">{t('titleLine2')}</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start relative">
          {/* Left Content - 60% */}
          <div className="lg:col-span-7 xl:col-span-7 text-left relative z-10 lg:pr-8 xl:pr-12">

            {/* Hero Title Part 2 (Line 3) */}
            <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-5 leading-[0.9] tracking-tight">
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

            {/* Primary CTAs */}
            <div
              className={`flex flex-col items-start gap-6 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.cta}ms` }}
            >
              {/* CTA Buttons Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <TrackedLink
                  href="/auth/signup"
                  aria-label={t('ctaAria')}
                  event="cta_clicked"
                  eventProperties={{
                    placement: 'landing_hero_primary',
                    action: 'signup',
                    variant,
                  }}
                  className="inline-flex items-center justify-center px-8 py-4 bg-brand-cta text-white font-bold text-lg rounded-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
                >
                  {t('cta')}
                </TrackedLink>
                <TrackedLink
                  href="https://calendly.com/teamshotspro/demo"
                  aria-label={t('bookDemoAria')}
                  event="cta_clicked"
                  eventProperties={{
                    placement: 'landing_hero_demo',
                    action: 'book_demo',
                    variant,
                  }}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-text-dark font-bold text-lg rounded-xl border-2 border-gray-200 hover:border-brand-primary hover:text-brand-primary transition-all duration-300 shadow-depth-md hover:shadow-depth-lg transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:ring-offset-2 ring-offset-bg-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('bookDemo')}
                </TrackedLink>
              </div>

              {/* Trust Badges */}
              <div className="flex items-center gap-4">
                {/* User Avatars */}
                <div className="flex -space-x-2">
                  <Image src="/images/avatars/avatar-1.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
                  <Image src="/images/avatars/avatar-2.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
                  <Image src="/images/avatars/avatar-3.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
                  <Image src="/images/avatars/avatar-4.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Rating */}
                <div className="flex items-center gap-1.5">
                  <div className="flex text-yellow-400 text-sm">
                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                  </div>
                  <span className="font-bold text-text-dark">4.9</span>
                </div>
              </div>

              {/* Sub-text */}
              <div className="flex flex-col gap-1.5 text-sm text-text-muted">
                <p className="flex items-center gap-2">
                  <PhotoIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('freeGenerationsLine')}</span>
                </p>
                <p className="flex items-center gap-2">
                  <CreditCardIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('noCreditCardLine')}</span>
                </p>
              </div>
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

        {/* Company Logos Bar - inside hero */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-2">
          <div className="relative pt-4">
            {/* Decorative line */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-white px-6 text-sm text-text-muted font-medium">
                {t('trustedBy')}
              </span>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center items-start gap-x-24 gap-y-8">
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/logos/notion.svg" alt="Notion" width={100} height={28} className="h-7 w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <span className="text-xs text-text-muted font-medium">Notion</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/logos/linear.svg" alt="Linear" width={90} height={28} className="h-6 w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <span className="text-xs text-text-muted font-medium">Linear</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/logos/vercel.svg" alt="Vercel" width={100} height={28} className="h-6 w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <span className="text-xs text-text-muted font-medium">Vercel</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/logos/figma.svg" alt="Figma" width={80} height={28} className="h-7 w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <span className="text-xs text-text-muted font-medium">Figma</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/logos/loom.svg" alt="Loom" width={80} height={28} className="h-6 w-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <span className="text-xs text-text-muted font-medium">Loom</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery - Team transformation examples */}
      <SampleGallery variant={variant} />

      {/* Trust Indicators - Shows Team Command Center feature */}
      {/* Hidden per user request */}
      {/* <TrustIndicators variant={variant} showSection={showSection} /> */}

      {/* How It Works - 4-step team workflow */}
      <HowItWorks variant={variant} />

      {/* Anti-Robot Guarantee Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-brand-primary-light via-bg-white to-brand-secondary-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-depth-2xl p-8 sm:p-12 border-4 border-brand-primary">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover rounded-full mb-6 shadow-depth-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6">
              100% Human-Look Guarantee
            </h3>
            <p className="text-lg sm:text-xl text-text-body leading-relaxed mb-4">
              If your photos look like AI, we redo them for free.
            </p>
            <p className="text-base sm:text-lg text-text-muted">
              Your team deserves to look professional, not robotic. We guarantee studio-quality results that look like you, just more polished.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <PricingPreview variant={variant} />

      {/* FAQ Section */}
      <FAQ variant={variant} supportEmail={supportEmail} />

      {/* Final CTA Section */}
      <section className="w-full bg-bg-gray-50 py-20 sm:py-24 lg:py-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
          <div className="mt-4 flex flex-col items-center gap-1.5 text-sm text-text-muted">
            <p className="flex items-center gap-2">
              <PhotoIcon className="w-4 h-4 flex-shrink-0" />
              <span>{t('freeGenerationsLine')}</span>
            </p>
            <p className="flex items-center gap-2">
              <CreditCardIcon className="w-4 h-4 flex-shrink-0" />
              <span>{t('noCreditCardLine')}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Feedback Button */}
      <FeedbackButton context="landing" />
    </div>
  );
}
