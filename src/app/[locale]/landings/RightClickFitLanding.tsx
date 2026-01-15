'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import TrustIndicators from '@/components/TrustIndicators';
import FAQ from '@/components/FAQ';
import { TrackedLink } from '@/components/TrackedLink';
import { prefersReducedMotion, ANIMATION_DELAYS } from '@/lib/animations';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ShoppingBagIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { LandingVariant, LandingSections } from '@/config/landing-content';
import type { LandingProps } from '../page';
import Image from 'next/image';

/**
 * RightClickFit Landing Page
 * 
 * Extension-focused landing page for virtual try-on.
 * Features:
 * - "Magic" / Viral utility emphasis
 * - Chrome Extension installation focus
 * - Visual demonstration of "Right Click -> Fit"
 */
export default function RightClickFitLanding({ supportEmail, variant }: LandingProps) {
  
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.hero`);
  
  // Animation state
  const [heroMounted, setHeroMounted] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const timer = requestAnimationFrame(() => setHeroMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Section visibility
  const showSection = (section: keyof LandingSections): boolean => {
    const visibility: LandingSections = {
      showTeamCommandCenter: false,
      showIndustryTemplates: false,
      showTeamFlow: false,
      showIndividualFlow: false, 
    };
    return visibility[section];
  };

  return (
    <div className="min-h-screen bg-bg-white relative grain-texture overflow-hidden">
      {/* Vibrant, energetic background for viral product */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-40 -z-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 -z-10"></div>
      
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 sm:pb-24 lg:pt-36 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-left relative z-10">
            {/* Viral Badge */}
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full mb-8 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } transition-all duration-500 ease-out`}
            >
              <span className="text-2xl">🛍️</span>
              <span className="text-sm font-bold text-purple-700">The #1 Virtual Fitting Room</span>
            </div>

            {/* Hero Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-text-dark mb-6 leading-[1.15] tracking-tight">
              {t('titleLine1')}{' '}
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {t('titleLine2')}
              </span>
            </h1>

            {/* Subtitle */}
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
              <strong className="text-text-dark block mt-2">{t('subtitleBold')}</strong>
            </p>

            {/* Primary CTA - Install Extension */}
            <div
              className={`flex flex-col items-start gap-4 ${
                heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              } transition-all duration-700 ease-out`}
              style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.cta}ms` }}
            >
              <TrackedLink
                href="/auth/signup" // TODO: Change to Chrome Store Link when available
                aria-label={t('ctaAria')}
                event="cta_clicked"
                eventProperties={{
                  placement: 'landing_hero_primary',
                  action: 'install_extension',
                  variant,
                }}
                className="inline-flex items-center justify-center px-8 py-4 bg-black text-white font-bold text-lg rounded-xl hover:bg-gray-800 transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 ring-offset-bg-white"
              >
                <span className="mr-2">Chrome</span>
                {t('cta')}
              </TrackedLink>
              <div className="flex flex-col gap-1.5 text-sm text-text-muted">
                <p className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 flex-shrink-0 text-purple-500" />
                  <span>{t('noCreditCardLine')}</span>
                </p>
                <p className="flex items-center gap-2">
                  <ShoppingBagIcon className="w-4 h-4 flex-shrink-0 text-blue-500" />
                  <span>{t('freeGenerationsLine')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Visual - Demo of Right Click -> Fit */}
          <div 
            className={`relative ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } transition-all duration-1000 ease-out`}
            style={{ transitionDelay: reducedMotion ? '0ms' : `${ANIMATION_DELAYS.hero.gallery}ms` }}
          >
            {/* Placeholder for Extension Demo Graphic */}
            <div className="w-full max-w-md mx-auto aspect-[4/5] bg-gradient-to-tr from-gray-100 to-gray-200 rounded-2xl shadow-2xl flex items-center justify-center border border-white/50 backdrop-blur-sm relative overflow-hidden group">
               <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
               <div className="text-center p-8">
                  <div className="text-6xl mb-4">👗 ➡️ 💃</div>
                  <p className="text-gray-500 font-medium">Extension Demo Preview</p>
                  <p className="text-xs text-gray-400 mt-2">(Right Click on Dress &rarr; See on You)</p>
               </div>
               
               {/* Floating UI Elements simulating the extension */}
               <div className="absolute top-1/4 right-1/4 bg-white p-3 rounded-lg shadow-lg transform rotate-3 animate-pulse">
                 <div className="text-xs font-bold text-gray-800">Right Click & Fit</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Simplified for Extension */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-xl text-gray-600">Three clicks to your perfect outfit.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-4">📥</div>
                <h3 className="text-xl font-bold mb-2">1. Install Extension</h3>
                <p className="text-gray-600">Add RightClickFit to your Chrome browser in seconds.</p>
             </div>
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-4">🖱️</div>
                <h3 className="text-xl font-bold mb-2">2. Right Click Item</h3>
                <p className="text-gray-600">Browse Zara, ASOS, or any store. Right-click the item you like.</p>
             </div>
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-xl font-bold mb-2">3. See It On You</h3>
                <p className="text-gray-600">Instantly see yourself wearing that exact item.</p>
             </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ variant={variant} supportEmail={supportEmail} />

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32 text-center">
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
            action: 'install_extension',
            variant,
          }}
          className="inline-flex items-center justify-center px-10 py-5 bg-black text-white font-bold text-xl rounded-xl hover:bg-gray-800 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2 ring-offset-bg-white"
        >
          {t('cta')}
        </TrackedLink>
      </section>

      {/* Feedback Button */}
      <FeedbackButton context="landing" />
    </div>
  );
}
