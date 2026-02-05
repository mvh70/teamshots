'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { TrackedLink } from '@/components/TrackedLink';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { CreditCardIcon, PhotoIcon, ClockIcon, ShieldCheckIcon, SparklesIcon, CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import type { LandingVariant } from '@/config/landing-content';
import type { LandingProps } from '../page';

/**
 * Portreya Landing Page V2 - Precision Studio Design
 *
 * Design System:
 * - Colors: Deep studio navy (#0F172A), warm ivory (#F5F0E8), bronze accent (#B45309)
 * - Typography: Playfair Display (display), Source Sans 3 (body)
 * - Signature: Viewfinder frames, subtle film grain, focus-reveal animations
 */

function ArrowRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function ViewfinderFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -top-2 -left-2 w-8 h-8 border-l-2 border-t-2 border-[#B45309]/60" aria-hidden="true" />
      <div className="absolute -top-2 -right-2 w-8 h-8 border-r-2 border-t-2 border-[#B45309]/60" aria-hidden="true" />
      <div className="absolute -bottom-2 -left-2 w-8 h-8 border-l-2 border-b-2 border-[#B45309]/60" aria-hidden="true" />
      <div className="absolute -bottom-2 -right-2 w-8 h-8 border-r-2 border-b-2 border-[#B45309]/60" aria-hidden="true" />
      {children}
    </div>
  );
}

function useFocusReveal(threshold = 0.2) {
  const [isVisible, setIsVisible] = useState(true);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }
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

  return { ref: setRef, isVisible };
}

function FilmGrain() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
      aria-hidden="true"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] focus-visible:ring-offset-2';
const focusRingDark = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]';

function BeforeAfterSlider({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = useCallback(() => { isDragging.current = true; }, []);
  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) updatePosition(e.clientX);
  }, [updatePosition]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden cursor-col-resize select-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onClick={(e) => updatePosition(e.clientX)}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(sliderPosition)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setSliderPosition(p => Math.max(0, p - 5));
        if (e.key === 'ArrowRight') setSliderPosition(p => Math.min(100, p + 5));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${alt} - after`} className="w-full h-auto block" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`${alt} - before`} className="w-full h-auto block" />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPosition}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          </svg>
        </div>
      </div>
      <div className="absolute top-3 left-3 bg-[#0F172A]/70 text-white px-2 py-1 text-xs font-medium tracking-wider uppercase">Before</div>
      <div className="absolute top-3 right-3 bg-[#B45309]/90 text-white px-2 py-1 text-xs font-medium tracking-wider uppercase">After</div>
    </div>
  );
}

function HeroGalleryV2() {
  return (
    <ViewfinderFrame className="w-full max-w-md mx-auto">
      <div className="relative bg-[#0F172A] p-3 shadow-2xl">
        <div className="flex items-center justify-between mb-3 text-[#F5F0E8]/60 text-xs tracking-widest uppercase" aria-hidden="true">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#B45309]" />
            AI STUDIO
          </span>
          <div className="flex items-center gap-2">
            <ClockIcon className="w-3 h-3" />
            <span>60s</span>
          </div>
        </div>
        <BeforeAfterSlider
          before="/samples/before-hero.webp"
          after="/samples/after-hero.webp"
          alt="Professional headshot transformation"
        />
        <div className="flex items-center justify-between mt-3 text-[#F5F0E8]/60 text-xs" aria-hidden="true">
          <span className="tracking-wider">AI GENERATED</span>
          <span className="text-[#B45309]">Portreya</span>
        </div>
      </div>
    </ViewfinderFrame>
  );
}

function TransformationGallery({ variant }: { variant: LandingVariant }) {
  const t = useTranslations(`landing.${variant}.gallery`);
  const { ref, isVisible } = useFocusReveal(0.1);

  const examples = [
    { before: '/samples/before-hero.webp', after: '/samples/after-hero.webp', name: 'Business Professional' },
    { before: '/samples/before-1.webp', after: '/samples/after-1.webp', name: 'Executive Portrait' },
    { before: '/samples/before-2.webp', after: '/samples/after-2.webp', name: 'Creative Director' },
  ];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#F5F0E8] relative overflow-hidden">
      <FilmGrain />
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-16 motion-safe:transition-[opacity,transform] motion-safe:duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0F172A] mb-6 leading-tight text-balance">{t('title')}</h2>
          <p className="text-lg text-[#0F172A]/70 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <div
              key={index}
              className={`motion-safe:transition-[opacity,transform] motion-safe:duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-12'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <ViewfinderFrame className="overflow-hidden">
                <BeforeAfterSlider before={example.before} after={example.after} alt={example.name} />
              </ViewfinderFrame>
              <div className="flex items-center gap-2 mt-4 px-1">
                <SparklesIcon className="w-4 h-4 text-[#B45309]" aria-hidden="true" />
                <span className="text-sm font-medium text-[#0F172A]/80 tracking-wider">{example.name}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`text-center mt-12 motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <Link href="/auth/signup" className={`inline-flex items-center gap-3 bg-[#0F172A] text-[#F5F0E8] px-10 py-5 text-sm font-medium tracking-wider uppercase hover:bg-[#1e293b] transition-colors ${focusRing}`}>
            {t('cta')}
            <ArrowRight className="w-4 h-4 text-[#B45309]" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorksV2({ variant }: { variant: LandingVariant }) {
  const t = useTranslations(`landing.${variant}.howItWorks`);
  const { ref, isVisible } = useFocusReveal(0.1);

  const steps = [
    { number: '01', key: '1' },
    { number: '02', key: '2' },
    { number: '03', key: '3' },
  ];

  return (
    <section ref={ref as any} className="py-16 sm:py-20 bg-[#0F172A] relative overflow-hidden">
      <FilmGrain />
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-12 motion-safe:transition-[opacity,transform] motion-safe:duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#F5F0E8] mb-4 leading-tight text-balance">{t('title')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`text-center motion-safe:transition-[opacity,transform] motion-safe:duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <span className="text-5xl font-serif text-[#B45309]/30 mb-3 block" aria-hidden="true">{step.number}</span>
              <h3 className="font-serif text-xl text-[#F5F0E8] mb-2">{t(`steps.${step.key}.title`)}</h3>
              <p className="text-[#F5F0E8]/60 text-sm leading-relaxed">{t(`steps.${step.key}.description`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingV2({ variant }: { variant: LandingVariant }) {
  const t = useTranslations(`landing.${variant}.pricing`);
  const { ref, isVisible } = useFocusReveal(0.1);

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className={`text-center mb-16 motion-safe:transition-[opacity,transform] motion-safe:duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0F172A] mb-6 text-balance">{t('title')}</h2>
          <p className="text-lg text-[#0F172A]/70 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Trial */}
          <div className={`p-8 border border-[#0F172A]/10 motion-safe:transition-[opacity,transform] motion-safe:duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`} style={{ transitionDelay: '100ms' }}>
            <h3 className="font-serif text-xl text-[#0F172A] mb-2">{t('tiers.free.name')}</h3>
            <p className="text-[#0F172A]/60 text-sm mb-6">{t('tiers.free.description')}</p>
            <div className="mb-6">
              <span className="font-serif text-4xl text-[#0F172A]">Free</span>
            </div>
            <ul className="space-y-3 text-sm text-[#0F172A]/70 mb-8">
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.free.features.headshots')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.free.features.style')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.free.features.noCreditCard')}</li>
            </ul>
            <Link href="/auth/signup" className={`block text-center py-3 border border-[#0F172A] text-[#0F172A] text-sm font-medium tracking-wider uppercase hover:bg-[#0F172A] hover:text-[#F5F0E8] transition-colors ${focusRing}`}>
              {t('tiers.free.cta')}
            </Link>
          </div>

          {/* Individual - Featured */}
          <div className={`p-8 border-2 border-[#B45309] relative bg-[#0F172A] motion-safe:transition-[opacity,transform] motion-safe:duration-700 shadow-2xl shadow-[#B45309]/10 ${isVisible ? 'opacity-100 translate-y-0 md:-translate-y-2' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`} style={{ transitionDelay: '200ms' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B45309] text-white px-4 py-1 text-xs font-medium tracking-wider uppercase">{t('tiers.individual.badge')}</div>
            <h3 className="font-serif text-xl text-[#F5F0E8] mb-2">{t('tiers.individual.name')}</h3>
            <p className="text-[#F5F0E8]/60 text-sm mb-6">{t('tiers.individual.description')}</p>
            <div className="mb-6">
              <span className="font-serif text-4xl text-[#F5F0E8] tabular-nums">{t('tiers.individual.price')}</span>
              <span className="text-[#F5F0E8]/60 text-sm"> {t('tiers.individual.priceLabel')}</span>
            </div>
            <ul className="space-y-3 text-sm text-[#F5F0E8]/70 mb-8">
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.individual.features.headshots')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.individual.features.customization')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.individual.features.retries')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.individual.features.guarantee')}</li>
            </ul>
            <Link href="/auth/signup" className={`block text-center py-3 bg-[#B45309] text-white text-sm font-medium tracking-wider uppercase hover:bg-[#92400e] transition-colors ${focusRingDark}`}>
              {t('tiers.individual.cta')}
            </Link>
          </div>

          {/* VIP */}
          <div className={`p-8 border border-[#0F172A]/10 motion-safe:transition-[opacity,transform] motion-safe:duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`} style={{ transitionDelay: '300ms' }}>
            <h3 className="font-serif text-xl text-[#0F172A] mb-2">{t('tiers.vip.name')}</h3>
            <p className="text-[#0F172A]/60 text-sm mb-6">{t('tiers.vip.description')}</p>
            <div className="mb-6">
              <span className="font-serif text-4xl text-[#0F172A] tabular-nums">{t('tiers.vip.price')}</span>
              <span className="text-[#0F172A]/60 text-sm"> {t('tiers.vip.priceLabel')}</span>
            </div>
            <ul className="space-y-3 text-sm text-[#0F172A]/70 mb-8">
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.vip.features.headshots')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.vip.features.team')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.vip.features.retries')}</li>
              <li className="flex items-center gap-2"><CheckIcon className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" /> {t('tiers.vip.features.guarantee')}</li>
            </ul>
            <Link href="/auth/signup" className={`block text-center py-3 border border-[#0F172A] text-[#0F172A] text-sm font-medium tracking-wider uppercase hover:bg-[#0F172A] hover:text-[#F5F0E8] transition-colors ${focusRing}`}>
              {t('tiers.vip.cta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQV2({ variant, supportEmail }: { variant: LandingVariant; supportEmail: string }) {
  const t = useTranslations(`landing.${variant}.faq`);
  const { ref, isVisible } = useFocusReveal(0.1);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqKeys = ['1', '2', '3', '4', '5'];

  return (
    <section ref={ref as any} className="py-24 sm:py-32 bg-[#F5F0E8] relative">
      <FilmGrain />
      <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className={`text-center mb-16 motion-safe:transition-[opacity,transform] motion-safe:duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0F172A] mb-6 text-balance">{t('title')}</h2>
        </div>
        <div className="space-y-4">
          {faqKeys.map((key, index) => (
            <div
              key={key}
              className={`border border-[#0F172A]/10 bg-[#FAFAF9] motion-safe:transition-[opacity,transform] motion-safe:duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}
              style={{ transitionDelay: `${Math.min(index, 4) * 100}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
                className={`w-full flex items-center justify-between p-6 text-left ${focusRing}`}
              >
                <span className="font-serif text-lg text-[#0F172A] pr-8">{t(`questions.${key}.q`)}</span>
                <span className={`text-[#B45309] text-2xl motion-safe:transition-transform shrink-0 ${openIndex === index ? 'rotate-45' : ''}`} aria-hidden="true">+</span>
              </button>
              <div className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 ${openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 text-[#0F172A]/70 leading-relaxed">{t(`questions.${key}.a`)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-12 text-center motion-safe:transition-[opacity,transform] motion-safe:duration-1000 motion-safe:delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-8'}`}>
          <p className="text-[#0F172A]/60 mb-4">{t('stillHaveQuestions')}</p>
          <a href={`mailto:${supportEmail}`} className={`text-[#B45309] hover:text-[#92400e] font-medium ${focusRing}`}>{supportEmail}</a>
        </div>
      </div>
    </section>
  );
}

export default function PortreyaLandingV2({ supportEmail, variant }: LandingProps) {
  const t = useTranslations(`landing.${variant}.hero`);
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF9] touch-action-manipulation">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap" />
      <meta name="theme-color" content="#FAFAF9" />
      <style jsx global>{`
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Source Sans 3', sans-serif; }
      `}</style>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:bg-[#B45309] focus:text-white focus:px-4 focus:py-2 focus:text-sm">
        Skip to main content
      </a>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-[#FAFAF9]/90 backdrop-blur-md border-b transition-shadow duration-300 ${scrolled ? 'border-[#0F172A]/8 shadow-sm' : 'border-[#0F172A]/5'}`}>
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className={`font-serif text-xl sm:text-2xl text-[#0F172A] tracking-tight ${focusRing}`}>
              Portreya
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              {isLoggedIn ? (
                <Link href="/app/dashboard" className={`text-sm text-[#0F172A]/70 hover:text-[#0F172A] transition-colors ${focusRing}`}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" className={`text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors ${focusRing}`}>
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className={`bg-[#B45309] text-white px-5 py-2.5 text-sm font-medium tracking-wider uppercase hover:bg-[#92400e] transition-colors ${focusRing}`}>
                    {t('tryFree')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-[#0F172A] mb-8 leading-[1.1] text-balance">
                  {t('titleLine1')} {t('titleLine2')} <span className="text-[#B45309]">{t('titleHighlight')}</span> {t('titleLine3')}
                </h1>
                <p className="text-lg sm:text-xl text-[#0F172A]/70 mb-10 max-w-lg leading-relaxed">{t('subtitle')}</p>
                <div className="space-y-6">
                  <TrackedLink
                    href="/auth/signup"
                    event="cta_clicked"
                    eventProperties={{ placement: 'landing_hero_primary', action: 'signup', variant }}
                    className={`inline-flex items-center gap-3 bg-[#B45309] text-white px-8 py-4 text-sm font-medium tracking-wider uppercase hover:bg-[#92400e] transition-colors shadow-lg shadow-[#B45309]/20 ${focusRing}`}
                  >
                    {t('cta')}
                    <ArrowRight />
                  </TrackedLink>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[#0F172A]/60">
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="w-4 h-4" aria-hidden="true" />
                      <span>{t('noCreditCardLine')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PhotoIcon className="w-4 h-4" aria-hidden="true" />
                      <span>{t('freeGenerationsLine')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <HeroGalleryV2 />
              </div>
            </div>
          </div>
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#B45309]/5 rounded-full blur-3xl -z-10" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0F172A]/5 rounded-full blur-3xl -z-10" aria-hidden="true" />
        </section>

        <TransformationGallery variant={variant} />
        <HowItWorksV2 variant={variant} />
        <PricingV2 variant={variant} />

        {/* Final CTA */}
        <section className="py-24 sm:py-32 bg-[#0F172A] relative overflow-hidden">
          <FilmGrain />
          <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center relative z-10">
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F5F0E8] mb-6 leading-tight text-balance">{t('finalCtaTitle')}</h2>
            <p className="text-lg text-[#F5F0E8]/70 mb-10 max-w-xl mx-auto">{t('finalCtaSubtitle')}</p>
            <TrackedLink
              href="/auth/signup"
              event="cta_clicked"
              eventProperties={{ placement: 'landing_final_cta', action: 'signup', variant }}
              className={`inline-flex items-center gap-3 bg-[#B45309] text-white px-10 py-5 text-sm font-medium tracking-wider uppercase hover:bg-[#92400e] transition-colors ${focusRingDark}`}
            >
              {t('finalCta')}
              <ArrowRight />
            </TrackedLink>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[#F5F0E8]/50">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4" aria-hidden="true" />
                <span>{t('trustBadges.moneyBack')}</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" aria-hidden="true" />
                <span>{t('trustBadges.instantResults')}</span>
              </div>
              <div className="flex items-center gap-2">
                <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
                <span>{t('trustBadges.photosPrivate')}</span>
              </div>
            </div>
          </div>
        </section>

        <FAQV2 variant={variant} supportEmail={supportEmail} />
      </main>

      {/* Footer */}
      <footer className="py-12 bg-[#0F172A] border-t border-[#F5F0E8]/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/" className={`font-serif text-xl text-[#F5F0E8] ${focusRingDark}`}>
              Portreya
            </Link>
            <div className="flex items-center gap-8 text-sm text-[#F5F0E8]/50">
              <Link href="/legal/privacy" className={`hover:text-[#F5F0E8] transition-colors ${focusRingDark}`}>Privacy</Link>
              <Link href="/legal/terms" className={`hover:text-[#F5F0E8] transition-colors ${focusRingDark}`}>Terms</Link>
              <a href={`mailto:${supportEmail}`} className={`hover:text-[#F5F0E8] transition-colors ${focusRingDark}`}>Support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#F5F0E8]/10 text-center text-sm text-[#F5F0E8]/30">
            &copy; 2026 Portreya. All rights reserved.
          </div>
        </div>
      </footer>

      <FeedbackButton context="landing" />
    </div>
  );
}
