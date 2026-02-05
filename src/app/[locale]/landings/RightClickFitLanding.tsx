'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrackedLink } from '@/components/TrackedLink';
import type { LandingVariant } from '@/config/landing-content';
import type { LandingProps } from '../page';
import { CursorArrowRaysIcon, BoltIcon, ShoppingBagIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

/**
 * RightClickFit Landing Page - "The Invisible Shopping Assistant"
 *
 * Based on Vibe Discovery:
 * - Reference: High-end fashion boutique's private dressing room with smart mirrors
 * - Emotion: Confident
 * - Collision: Luxury fashion editorial + hacker terminal
 * - Anti-patterns: Cheap filter app, social media toy, enterprise B2B tool
 *
 * Design System:
 * - Colors: Electric violet (#7C3AED), terminal black (#0A0A0F), fashion white (#FAFAFA), neon accent (#00FF88)
 * - Typography: Sharp, tech-forward
 * - Signature: Sharp corners, scan lines, context menu motifs, terminal cursors
 */

// Scan Line Overlay
function ScanLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03] motion-reduce:hidden"
      style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          #00FF88 2px,
          #00FF88 4px
        )`,
      }}
    />
  );
}

// Context Menu Frame - mimics browser right-click menu
function ContextMenuFrame({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Menu header bar */}
      {title && (
        <div className="bg-[#1a1a2e] text-[#00FF88] px-4 py-2 text-xs font-mono tracking-wider border-b border-[#7C3AED]/30 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED]" aria-hidden="true" />
          {title}
        </div>
      )}
      {/* Menu body */}
      <div className="bg-[#0A0A0F] border border-[#7C3AED]/40 shadow-2xl shadow-[#7C3AED]/20">
        {children}
      </div>
      {/* Corner accents */}
      <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-[#00FF88]" aria-hidden="true" />
      <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-[#00FF88]" aria-hidden="true" />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-[#00FF88]" aria-hidden="true" />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-[#00FF88]" aria-hidden="true" />
    </div>
  );
}

// Reveal Animation Hook
function useReveal(threshold = 0.2) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    if (mq.matches) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }

    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      { threshold }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold, hasAnimated]);

  return { ref: setRef, isVisible, prefersReducedMotion };
}

// Hero Section with Browser Mockup
function HeroSection({ variant }: { variant: LandingVariant }) {
  const t = useTranslations(`landing.${variant}.hero`);
  const [showTryOn, setShowTryOn] = useState(false);

  return (
    <section className="relative min-h-screen bg-[#0A0A0F] overflow-hidden touch-manipulation">
      <ScanLines />

      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#7C3AED 1px, transparent 1px), linear-gradient(90deg, #7C3AED 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-20 pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center min-h-[80vh]">
          {/* Left: Copy */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/30 px-4 py-2">
              <BoltIcon className="w-4 h-4 text-[#00FF88]" aria-hidden="true" />
              <span className="text-[#00FF88] text-xs font-mono tracking-wider uppercase">Chrome Extension</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#FAFAFA] leading-[0.95] tracking-tight text-pretty">
              Try on any outfit.
              <br />
              <span className="text-[#7C3AED]">Right-click.</span>
              <br />
              Done.
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-[#FAFAFA]/60 max-w-lg leading-relaxed">
              The invisible shopping assistant. Right-click any clothing image online and see it on you in seconds. Works on every store.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <TrackedLink
                href="/auth/signup"
                event="cta_clicked"
                eventProperties={{ placement: 'hero', label: 'hero-cta-primary' }}
                className="inline-flex items-center justify-center gap-3 bg-[#7C3AED] text-white px-8 py-4 text-sm font-semibold tracking-wide hover:bg-[#6D28D9] transition-colors duration-200 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]"
              >
                <ShoppingBagIcon className="w-5 h-5" aria-hidden="true" />
                Add to Chrome — Free
              </TrackedLink>
              <button
                onClick={() => setShowTryOn(!showTryOn)}
                className="inline-flex items-center justify-center gap-3 bg-transparent text-[#FAFAFA] px-8 py-4 text-sm font-medium tracking-wide border border-[#7C3AED]/50 hover:border-[#7C3AED] hover:bg-[#7C3AED]/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]"
              >
                <CursorArrowRaysIcon className="w-5 h-5" aria-hidden="true" />
                See Demo
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 text-sm text-[#FAFAFA]/40">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[#00FF88]" aria-hidden="true" />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[#00FF88]" aria-hidden="true" />
                <span>3 free tries</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[#00FF88]" aria-hidden="true" />
                <span>Works everywhere</span>
              </div>
            </div>
          </div>

          {/* Right: Browser Mockup */}
          <div className="relative">
            <ContextMenuFrame title="rightclickfit.js" className="transform rotate-1 hover:rotate-0 transition-transform duration-500 motion-reduce:transform-none">
              {/* Browser chrome */}
              <div className="bg-[#1a1a2e] border-b border-[#7C3AED]/20 p-3 flex items-center gap-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 bg-[#0A0A0F] rounded px-3 py-1.5 text-xs text-[#FAFAFA]/40 font-mono flex items-center gap-2">
                  <span className="text-[#00FF88]">https://</span>
                  zara.com/dress-floral-...
                </div>
              </div>

              {/* Content area */}
              <div className="p-0">
                {/* Product image */}
                <div className="relative aspect-[4/3] bg-[#1a1a2e]">
                  <div className={`w-full h-full bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center transition-opacity duration-500 motion-reduce:transition-none ${showTryOn ? 'opacity-30' : 'opacity-100'}`}>
                    <div className="text-center">
                      <div className="text-6xl mb-2" aria-hidden="true">&#x1F457;</div>
                      <p className="text-[#FAFAFA]/40 text-sm">Floral Summer Dress</p>
                      <p className="text-[#00FF88] text-xs">$89.00</p>
                    </div>
                  </div>

                  {/* Right-click context menu overlay */}
                  {!showTryOn && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1a1a2e] border border-[#7C3AED]/30 shadow-2xl py-2 min-w-[200px]" aria-label="Simulated right-click context menu" role="presentation">
                      <div className="px-3 py-1.5 text-[#FAFAFA]/40 text-xs border-b border-[#7C3AED]/20 mb-1">
                        Right-click menu
                      </div>
                      <div className="px-3 py-2 text-[#FAFAFA]/70 text-sm flex items-center gap-2">
                        <span className="text-[#00FF88]" aria-hidden="true">&rarr;</span> Open image in new tab
                      </div>
                      <div className="px-3 py-2 text-[#FAFAFA]/70 text-sm flex items-center gap-2">
                        <span className="text-[#00FF88]" aria-hidden="true">&rarr;</span> Save image as&hellip;
                      </div>
                      <div className="px-3 py-2 bg-[#7C3AED] text-white text-sm font-medium flex items-center gap-2">
                        <BoltIcon className="w-4 h-4" aria-hidden="true" />
                        Try this on me
                      </div>
                      <div className="px-3 py-2 text-[#FAFAFA]/70 text-sm flex items-center gap-2">
                        <span className="text-[#00FF88]" aria-hidden="true">&rarr;</span> Copy image address
                      </div>
                    </div>
                  )}

                  {/* Try-on result overlay */}
                  {showTryOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0F]/90">
                      <div className="text-center space-y-4">
                        <div className="w-48 h-64 mx-auto bg-gradient-to-b from-[#7C3AED]/20 to-[#00FF88]/20 border border-[#7C3AED]/50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-4xl mb-2" aria-hidden="true">&#x1F483;</div>
                            <span className="text-[#FAFAFA]/60 text-sm">You wearing it</span>
                          </div>
                        </div>
                        <p className="text-[#00FF88] text-sm font-mono">Generated in 3.2s</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status bar */}
                <div className="bg-[#1a1a2e] px-4 py-2 text-xs text-[#FAFAFA]/40 font-mono flex items-center justify-between border-t border-[#7C3AED]/20">
                  <span>Ready</span>
                  <span className="text-[#00FF88]">RightClickFit v1.0</span>
                </div>
              </div>
            </ContextMenuFrame>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 bg-[#00FF88] text-[#0A0A0F] px-4 py-2 text-xs font-bold tracking-wider transform rotate-3" aria-hidden="true">
              INSTANT
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);

  const steps = [
    {
      number: '01',
      title: 'Install Extension',
      description: 'Add RightClickFit to Chrome in one click. No account needed to start.',
      icon: ShoppingBagIcon,
    },
    {
      number: '02',
      title: 'Right-Click Any Outfit',
      description: 'Browse any store. See something you like? Right-click the image.',
      icon: CursorArrowRaysIcon,
    },
    {
      number: '03',
      title: 'See It On You',
      description: 'AI generates a realistic preview in seconds. Save or buy with confidence.',
      icon: BoltIcon,
    },
  ];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#0A0A0F] relative overflow-hidden">
      <ScanLines />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-20 ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}`}>
          <span className="text-[#00FF88] text-xs font-mono tracking-[0.3em] uppercase mb-4 block">
            ./workflow.exe
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#FAFAFA] mb-6 text-pretty">
            How it works
          </h2>
          <p className="text-lg text-[#FAFAFA]/50 max-w-2xl mx-auto">
            Three steps. Zero friction. The fastest way to try on clothes online.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`relative ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}`}
              style={prefersReducedMotion ? undefined : { transitionDelay: `${index * 150}ms` }}
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-[1px] bg-gradient-to-r from-[#7C3AED]/50 to-transparent" aria-hidden="true" />
              )}

              <div className="bg-[#1a1a2e]/50 border border-[#7C3AED]/20 p-8 hover:border-[#7C3AED]/50 transition-colors group">
                {/* Step number */}
                <div className="text-5xl font-bold text-[#7C3AED]/20 mb-6 font-mono group-hover:text-[#7C3AED]/40 transition-colors" aria-hidden="true">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="w-12 h-12 bg-[#7C3AED]/10 border border-[#7C3AED]/30 flex items-center justify-center mb-6 group-hover:bg-[#7C3AED]/20 transition-colors">
                  <step.icon className="w-6 h-6 text-[#00FF88]" aria-hidden="true" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-[#FAFAFA] mb-3">
                  {step.title}
                </h3>
                <p className="text-[#FAFAFA]/50 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Works Everywhere Section
function WorksEverywhereSection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);

  const stores = [
    { name: 'Amazon', icon: 'A' },
    { name: 'Zara', icon: 'Z' },
    { name: 'H&M', icon: 'H' },
    { name: 'ASOS', icon: 'AS' },
    { name: 'Nike', icon: 'N' },
    { name: 'Zalando', icon: 'ZA' },
    { name: 'Shein', icon: 'SH' },
    { name: 'Uniqlo', icon: 'U' },
  ];

  return (
    <section ref={ref as any} className="py-20 bg-[#0A0A0F] border-y border-[#7C3AED]/20">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className={`text-center mb-12 ${prefersReducedMotion ? '' : `transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}`}>
          <p className="text-[#FAFAFA]/40 text-sm tracking-wider uppercase">
            Works on every store
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {stores.map((store, index) => (
            <div
              key={store.name}
              className={`flex items-center gap-3 text-[#FAFAFA]/30 hover:text-[#FAFAFA]/60 transition-colors duration-500 ${prefersReducedMotion ? '' : `${isVisible ? 'opacity-100' : 'opacity-0'}`}`}
              style={prefersReducedMotion ? undefined : { transitionDelay: `${index * 50}ms` }}
            >
              <div className="w-10 h-10 bg-[#1a1a2e] border border-[#7C3AED]/20 flex items-center justify-center text-sm font-bold" aria-hidden="true">
                {store.icon}
              </div>
              <span className="text-sm font-medium tracking-wide">{store.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Comparison Section
function ComparisonSection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);

  const comparisons = [
    { feature: 'Works on any website', rightclickfit: true, social: false },
    { feature: 'Real shopping context', rightclickfit: true, social: false },
    { feature: 'See exact item on you', rightclickfit: true, social: false },
    { feature: 'No app download needed', rightclickfit: true, social: false },
    { feature: 'Private (no sharing)', rightclickfit: true, social: false },
    { feature: 'Price comparison ready', rightclickfit: true, social: false },
  ];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#0A0A0F] relative overflow-hidden">
      <ScanLines />

      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-16 ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}`}>
          <span className="text-[#00FF88] text-xs font-mono tracking-[0.3em] uppercase mb-4 block">
            Why us
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#FAFAFA] mb-6 text-pretty">
            Not another filter app
          </h2>
          <p className="text-lg text-[#FAFAFA]/50 max-w-2xl mx-auto">
            Social media AR is for entertainment. RightClickFit is for actually buying clothes.
          </p>
        </div>

        <ContextMenuFrame title="comparison_matrix.dat">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#7C3AED]/20 bg-[#1a1a2e]/50">
                <th className="text-left text-[#FAFAFA]/40 text-sm font-mono font-normal p-6">Feature</th>
                <th className="text-center p-6">
                  <span className="text-[#00FF88] font-bold text-sm tracking-wider">RIGHTCLICKFIT</span>
                </th>
                <th className="text-center text-[#FAFAFA]/40 text-sm font-normal p-6">Social Media AR</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b border-[#7C3AED]/10 hover:bg-[#7C3AED]/5 transition-colors ${prefersReducedMotion ? '' : `${isVisible ? 'opacity-100' : 'opacity-0'}`}`}
                  style={prefersReducedMotion ? undefined : { transitionDelay: `${index * 100}ms` }}
                >
                  <td className="text-[#FAFAFA]/80 text-sm p-6">{row.feature}</td>
                  <td className="text-center p-6">
                    {row.rightclickfit ? (
                      <>
                        <CheckIcon className="w-5 h-5 text-[#00FF88] mx-auto" aria-hidden="true" />
                        <span className="sr-only">Yes</span>
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="w-5 h-5 text-[#FAFAFA]/20 mx-auto" aria-hidden="true" />
                        <span className="sr-only">No</span>
                      </>
                    )}
                  </td>
                  <td className="text-center p-6">
                    {row.social ? (
                      <>
                        <CheckIcon className="w-5 h-5 text-[#FAFAFA]/40 mx-auto" aria-hidden="true" />
                        <span className="sr-only">Yes</span>
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="w-5 h-5 text-[#FAFAFA]/20 mx-auto" aria-hidden="true" />
                        <span className="sr-only">No</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContextMenuFrame>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);

  const plans = [
    {
      name: 'Free Trial',
      price: '$0',
      period: 'one-time',
      credits: '3 tries',
      features: ['Works on all sites', 'Standard quality', 'No watermark', 'No credit card required'],
      cta: 'Start Free',
      popular: false,
    },
    {
      name: 'Starter',
      price: '$5',
      period: 'one-time',
      credits: '40 credits',
      perCredit: '$0.125 each',
      features: ['Works on all sites', 'High quality', 'No watermark', 'Credits never expire'],
      cta: 'Buy Credits',
      popular: true,
    },
    {
      name: 'Unlimited',
      price: '$19',
      period: '/month',
      credits: 'Unlimited',
      features: ['Everything in Starter', 'Priority generation', 'Early access to features', 'Cancel anytime'],
      cta: 'Go Unlimited',
      popular: false,
    },
  ];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#0A0A0F] relative overflow-hidden">
      <ScanLines />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-16 ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}`}>
          <span className="text-[#00FF88] text-xs font-mono tracking-[0.3em] uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#FAFAFA] mb-6 text-pretty">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-[#FAFAFA]/50 max-w-2xl mx-auto">
            Pay for what you use. No subscriptions required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}`}
              style={prefersReducedMotion ? undefined : { transitionDelay: `${index * 150}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#00FF88] text-[#0A0A0F] px-4 py-1 text-xs font-bold tracking-wider">
                  MOST POPULAR
                </div>
              )}

              <div className={`h-full bg-[#1a1a2e]/50 border ${plan.popular ? 'border-[#7C3AED]' : 'border-[#7C3AED]/20'} p-8 hover:border-[#7C3AED]/50 transition-colors`}>
                {/* Plan name */}
                <div className="text-[#FAFAFA]/60 text-sm font-mono tracking-wider mb-4">
                  {plan.name.toUpperCase()}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-[#FAFAFA] font-variant-numeric tabular-nums">{plan.price}</span>
                  <span className="text-[#FAFAFA]/40">{plan.period}</span>
                </div>

                {/* Credits */}
                <div className="text-[#00FF88] font-medium mb-1">{plan.credits}</div>
                {plan.perCredit && (
                  <div className="text-[#FAFAFA]/40 text-sm mb-6">{plan.perCredit}</div>
                )}

                {/* CTA */}
                <TrackedLink
                  href="/auth/signup"
                  event="cta_clicked"
                  eventProperties={{ placement: 'pricing', label: `pricing-${plan.name.toLowerCase().replace(' ', '-')}` }}
                  className={`w-full block text-center py-3 text-sm font-semibold tracking-wide mb-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] ${
                    plan.popular
                      ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                      : 'bg-transparent text-[#FAFAFA] border border-[#7C3AED]/50 hover:border-[#7C3AED] hover:bg-[#7C3AED]/10'
                  }`}
                >
                  {plan.cta}
                </TrackedLink>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3 text-sm text-[#FAFAFA]/60">
                      <CheckIcon className="w-4 h-4 text-[#00FF88] flex-shrink-0" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Section
function FAQSection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How does RightClickFit work?',
      answer: 'Install the Chrome extension, upload a photo of yourself once, then right-click any clothing image on any website. Our AI generates a realistic preview of you wearing that item in seconds.',
    },
    {
      question: 'Does it work on all websites?',
      answer: 'Yes. RightClickFit works on any website where you can right-click an image \u2014 Amazon, Zara, H&M, ASOS, independent boutiques, even Instagram. If you can see it, you can try it on.',
    },
    {
      question: 'Is my photo secure?',
      answer: 'Your photos are processed securely and never shared or sold. We use them only to generate your try-ons. You can delete your data at any time.',
    },
    {
      question: 'How accurate are the results?',
      answer: 'Our AI is trained specifically on fashion try-ons and produces photorealistic results that respect body shape, fabric drape, and lighting. While not perfect, it gives you a much better sense than guessing.',
    },
    {
      question: 'Can I cancel my subscription?',
      answer: 'Yes, you can cancel anytime. Credits you purchase never expire, even if you cancel. We also offer a free trial with 3 credits so you can test before buying.',
    },
  ];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#0A0A0F] relative overflow-hidden">
      <ScanLines />

      <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-16 ${prefersReducedMotion ? '' : `transition-opacity transition-transform duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}`}>
          <span className="text-[#00FF88] text-xs font-mono tracking-[0.3em] uppercase mb-4 block">
            FAQ
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#FAFAFA] mb-6 text-pretty">
            Questions? Answered.
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`border border-[#7C3AED]/20 bg-[#1a1a2e]/30 ${prefersReducedMotion ? '' : `transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}`}
              style={prefersReducedMotion ? undefined : { transitionDelay: `${index * 100}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-[#7C3AED]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7C3AED]"
              >
                <span className="text-[#FAFAFA] font-medium pr-4">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUpIcon className="w-5 h-5 text-[#00FF88] flex-shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-[#7C3AED] flex-shrink-0" aria-hidden="true" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6 text-[#FAFAFA]/60 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Final CTA Section
function FinalCTASection({ variant }: { variant: LandingVariant }) {
  const { ref, isVisible, prefersReducedMotion } = useReveal(0.1);

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#0A0A0F] relative overflow-hidden">
      <ScanLines />

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10 text-center">
        <div className={prefersReducedMotion ? '' : `transition-opacity transition-transform duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#FAFAFA] mb-6 text-pretty">
            Stop guessing.
            <br />
            <span className="text-[#7C3AED]">Start trying on.</span>
          </h2>
          <p className="text-xl text-[#FAFAFA]/50 max-w-2xl mx-auto mb-10">
            Join thousands of shoppers who never buy blind. Install RightClickFit free.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrackedLink
              href="/auth/signup"
              event="cta_clicked"
              eventProperties={{ placement: 'final_cta', label: 'final-cta-primary' }}
              className="inline-flex items-center justify-center gap-3 bg-[#7C3AED] text-white px-10 py-5 text-sm font-semibold tracking-wide hover:bg-[#6D28D9] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]"
            >
              <ShoppingBagIcon className="w-5 h-5" aria-hidden="true" />
              Add to Chrome — Free
            </TrackedLink>
          </div>

          <p className="mt-6 text-sm text-[#FAFAFA]/40">
            3 free tries. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer({ supportEmail, variant }: { supportEmail: string; variant: LandingVariant }) {
  return (
    <footer className="py-12 bg-[#0A0A0F] border-t border-[#7C3AED]/20">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#7C3AED] flex items-center justify-center" aria-hidden="true">
              <CursorArrowRaysIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#FAFAFA] font-bold tracking-wider">RIGHTCLICKFIT</span>
          </div>

          <nav className="flex items-center gap-8 text-sm text-[#FAFAFA]/40" aria-label="Footer">
            <Link href="/privacy" className="hover:text-[#FAFAFA]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] rounded">Privacy</Link>
            <Link href="/terms" className="hover:text-[#FAFAFA]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] rounded">Terms</Link>
            <a href={`mailto:${supportEmail}`} className="hover:text-[#FAFAFA]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] rounded">Support</a>
          </nav>

          <div className="text-sm text-[#FAFAFA]/30">
            &copy; 2026 RightClickFit. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Component
export default function RightClickFitLanding({ supportEmail, variant }: LandingProps) {
  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#7C3AED] focus:text-white focus:px-4 focus:py-2 focus:text-sm">
        Skip to main content
      </a>
      <div id="main-content">
        <HeroSection variant={variant} />
        <HowItWorksSection variant={variant} />
        <WorksEverywhereSection variant={variant} />
        <ComparisonSection variant={variant} />
        <PricingSection variant={variant} />
        <FAQSection variant={variant} />
        <FinalCTASection variant={variant} />
        <Footer supportEmail={supportEmail} variant={variant} />
      </div>
    </main>
  );
}
