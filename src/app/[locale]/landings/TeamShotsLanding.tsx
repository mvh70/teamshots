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
import GuaranteeSection from '@/components/GuaranteeSection';
import { TrackedLink } from '@/components/TrackedLink';
import { prefersReducedMotion, ANIMATION_DELAYS } from '@/lib/animations';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { CreditCardIcon, PhotoIcon, ShieldCheckIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline';
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
export default function TeamShotsLanding({ supportEmail, variant }: LandingProps) {

  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.hero`);
  const tTestimonials = useTranslations(`landing.${variant}.testimonials`);

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
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-text-dark leading-[0.9] tracking-tight text-wrap-balance">
            <span className="block">{t('titleLine1')}</span>
            <span className="block">{t('titleLine2')}</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start relative">
          {/* Left Content - 60% */}
          <div className="lg:col-span-7 xl:col-span-7 text-left relative z-10 lg:pr-8 xl:pr-12">

            {/* Hero Title Part 2 (Line 3) */}
            <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-5 leading-[0.9] tracking-tight text-wrap-balance">
              <span className="block bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary bg-clip-text text-transparent">
                {t('titleHighlightTime')}
              </span>
            </div>

            {/* Subtitle */}
            <p
              className={`text-xl sm:text-2xl md:text-2xl lg:text-3xl text-text-body mb-10 max-w-2xl leading-[1.4] font-medium ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-[opacity,transform] duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle}ms` }}
            >
              {t('subtitleMain')}
            </p>

            {/* Supporting Description */}
            <p
              className={`text-base sm:text-lg lg:text-xl text-text-body mb-8 max-w-xl leading-[1.7] ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-[opacity,transform] duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 100}ms` }}
            >
              {t('subtitle')} {t('subtitleBold')}
            </p>

            {/* Free trial lines - prominent above CTA */}
            <div
              className={`flex flex-col gap-2 text-base sm:text-lg text-text-body mb-6 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-[opacity,transform] duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.subtitle + 150}ms` }}
            >
              <p className="flex items-center gap-2">
                <PhotoIcon className="w-5 h-5 flex-shrink-0 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">{t('freeGenerationsLine')}</span>
              </p>
              <p className="flex items-center gap-2">
                <CreditCardIcon className="w-5 h-5 flex-shrink-0 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">{t('noCreditCardLine')}</span>
              </p>
            </div>

            {/* Primary CTA */}
            <div
              className={`flex flex-col items-start gap-6 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } transition-[opacity,transform] duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.cta}ms` }}
            >
              {/* Single CTA Button */}
              <TrackedLink
                href="/auth/signup"
                aria-label={t('ctaAria')}
                event="cta_clicked"
                eventProperties={{
                  placement: 'landing_hero_primary',
                  action: 'signup',
                  variant,
                }}
                className="inline-flex items-center justify-center px-8 py-4 bg-brand-cta text-white font-bold text-lg rounded-xl hover:bg-brand-cta-hover transition-[background-color,box-shadow,transform] duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
              >
                {t('cta')}
              </TrackedLink>

              {/* Security & Speed Trust Badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <ShieldCheckIcon className="w-4 h-4 text-green-600" aria-hidden="true" />
                  <span className="font-medium">{t('trustBadges.stripeSecure')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <ClockIcon className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                  <span className="font-medium">{t('trustBadges.instantResults')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <BanknotesIcon className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                  <span className="font-medium">{t('trustBadges.noSubscription')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  <ShieldCheckIcon className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                  <span className="font-medium">{t('trustBadges.moneyBack')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Gallery */}
          <div
            className={`lg:col-span-4 min-w-0 relative ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-[opacity,transform] duration-1000 ease-out`}
            style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` }}
          >
            <div className="w-full max-w-lg mx-auto lg:ml-auto lg:mr-0 lg:absolute lg:top-0 lg:right-4 xl:right-8 lg:translate-x-0">
              <HeroGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-6 bg-bg-gray-50">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm sm:text-base text-text-muted">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-dark">{t('socialProof.headshots')}</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-gray-200" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-dark">{t('socialProof.teams')}</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-gray-200" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400" aria-hidden="true">★</span>
              <span className="font-bold text-text-dark">{t('socialProof.rating')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Gallery - Team transformation examples */}
      <SampleGallery variant={variant} />

      {/* Trust Indicators - Shows Team Command Center feature */}
      {/* <TrustIndicators variant={variant} showSection={showSection} /> */}

      {/* How It Works - 4-step team workflow */}
      <HowItWorks variant={variant} />

      {/* Anti-Robot Guarantee Section */}
      <GuaranteeSection variant={variant} />

      {/* Pricing Preview */}
      <PricingPreview variant={variant} />

      {/* Testimonials Section */}
      <section className="py-20 sm:py-24 lg:py-32 bg-bg-white relative grain-texture">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6 leading-tight">
              {tTestimonials('title')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(['1', '2', '3'] as const).map((id) => (
              <div key={id} className="bg-bg-gray-50 rounded-2xl p-8 border border-gray-200">
                <div className="flex text-yellow-400 text-lg mb-4" aria-hidden="true">
                  <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                </div>
                <blockquote className="text-text-body text-base leading-relaxed mb-6">
                  &ldquo;{tTestimonials(`items.${id}.quote`)}&rdquo;
                </blockquote>
                <div>
                  <p className="font-bold text-text-dark text-sm">{tTestimonials(`items.${id}.name`)}</p>
                  <p className="text-text-muted text-sm">
                    {tTestimonials(`items.${id}.role`)} · {tTestimonials(`items.${id}.company`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ variant={variant} supportEmail={supportEmail} />

      {/* Final CTA Section */}
      <section className="w-full bg-bg-white py-20 sm:py-24 lg:py-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight text-wrap-balance">
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
            className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white font-bold text-xl rounded-2xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-[box-shadow,transform] duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
          >
            {t('finalCtaCta')}
          </TrackedLink>
          <div className="mt-4 flex flex-col items-center gap-1.5 text-sm text-text-muted">
            <p className="flex items-center gap-2">
              <PhotoIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{t('freeGenerationsLine')}</span>
            </p>
            <p className="flex items-center gap-2">
              <CreditCardIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
