'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { LandingVariant } from '@/config/landing-content';

interface Step {
  id: number;
  icon: React.ReactNode;
  tabLabel: string;
  image?: string;
  title: string;
  description: string;
  duration: string;
}

// Tab icons - compact versions for tab bar
const TAB_ICONS = {
  sliders: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
    </svg>
  ),
  paperPlane: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  mobilePhone: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  downloadFolder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  customize: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

// Icon mapping per variant and step
const VARIANT_TAB_ICONS: Partial<Record<LandingVariant, Record<number, React.ReactNode>>> = {
  teamshotspro: {
    1: TAB_ICONS.sliders,
    2: TAB_ICONS.paperPlane,
    3: TAB_ICONS.mobilePhone,
    4: TAB_ICONS.downloadFolder,
  },
  individualshots: {
    1: TAB_ICONS.upload,
    2: TAB_ICONS.customize,
    3: TAB_ICONS.sparkle,
  },
  portreya: {
    1: TAB_ICONS.upload,
    2: TAB_ICONS.customize,
    3: TAB_ICONS.sparkle,
  },
  coupleshots: {
    1: TAB_ICONS.upload,
    2: TAB_ICONS.customize,
    3: TAB_ICONS.sparkle,
  },
};

// Tab label translation keys per variant
const VARIANT_TAB_LABEL_KEYS: Partial<Record<LandingVariant, Record<number, string>>> = {
  teamshotspro: {
    1: 'tabs.setBrand',
    2: 'tabs.inviteTeam',
    3: 'tabs.teamSelfie',
    4: 'tabs.getAssets',
  },
  individualshots: {
    1: 'tabs.upload',
    2: 'tabs.customize',
    3: 'tabs.generate',
  },
  portreya: {
    1: 'tabs.upload',
    2: 'tabs.customize',
    3: 'tabs.generate',
  },
  coupleshots: {
    1: 'tabs.upload',
    2: 'tabs.customize',
    3: 'tabs.generate',
  },
};

// Step images for TeamShotsPro
const VARIANT_IMAGES: Partial<Record<LandingVariant, Record<number, string>>> = {
  teamshotspro: {
    1: '/images/how-it-works/step-1-v2.png',
    2: '/images/how-it-works/step-2-v3.png',
    3: '/images/how-it-works/step-3-v2.png',
    4: '/images/how-it-works/step-4-v2.png',
  },
  // Portreya uses same images as teamshotspro, minus team management
  // Step 1 (Upload) → teamshotspro step 3 (selfie upload)
  // Step 2 (Customize) → teamshotspro step 1 (branding/style)
  // Step 3 (Generate) → teamshotspro step 4 (results)
  portreya: {
    1: '/images/how-it-works/step-3-v2.png',
    2: '/images/how-it-works/step-1-v2.png',
    3: '/images/how-it-works/step-4-v2.png',
  },
  individualshots: {},
  coupleshots: {},
};

interface HowItWorksProps {
  /** Landing page variant for domain-specific content */
  variant: LandingVariant;
}

// Auto-advance interval in milliseconds
const AUTO_ADVANCE_INTERVAL = 5000;
// Pause duration after user interaction before resuming auto-advance
const PAUSE_AFTER_INTERACTION = 10000;

export default function HowItWorks({ variant }: HowItWorksProps) {
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.howItWorks`);
  const [activeStep, setActiveStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { track } = useAnalytics();

  // Build steps dynamically based on variant
  const STEPS: Step[] = useMemo(() => {
    const icons = VARIANT_TAB_ICONS[variant] ?? VARIANT_TAB_ICONS.teamshotspro ?? {};
    const tabLabelKeys = VARIANT_TAB_LABEL_KEYS[variant] ?? VARIANT_TAB_LABEL_KEYS.teamshotspro ?? {};
    const images = VARIANT_IMAGES[variant] ?? {};
    const stepCount = variant === 'teamshotspro' ? 4 : 3;

    return Array.from({ length: stepCount }, (_, i) => {
      const stepNum = i + 1;
      const labelKey = tabLabelKeys[stepNum];
      return {
        id: stepNum,
        icon: icons[stepNum] ?? TAB_ICONS.sparkle,
        tabLabel: labelKey ? t(labelKey) : `Step ${stepNum}`,
        image: images[stepNum],
        title: t(`steps.${stepNum}.title`),
        description: t(`steps.${stepNum}.description`),
        duration: t(`steps.${stepNum}.duration`),
      };
    });
  }, [variant, t]);

  // Get active step data
  const activeStepData = STEPS.find(s => s.id === activeStep) || STEPS[0];

  // Ref to track pause timeout
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle user interaction - pause auto-advance temporarily
  const handleUserInteraction = useCallback((stepId: number) => {
    setActiveStep(stepId);
    setIsPaused(true);

    // Clear any existing timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }

    // Resume auto-advance after pause duration
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, PAUSE_AFTER_INTERACTION);
  }, []);

  // Auto-advance effect
  useEffect(() => {
    if (!isVisible || isPaused) return;

    const interval = setInterval(() => {
      setActiveStep(current => {
        const nextStep = current >= STEPS.length ? 1 : current + 1;
        return nextStep;
      });
    }, AUTO_ADVANCE_INTERVAL);

    return () => clearInterval(interval);
  }, [isVisible, isPaused, STEPS.length]);

  // Cleanup pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  // Intersection observer for visibility animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    const element = document.getElementById('how-it-works');
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-bg-gray-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-3xl translate-y-1/3" />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10">

        {/* Header */}
        <div className={`mb-10 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-text-dark leading-[1.1]">
            {t('title')}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className={`flex flex-wrap gap-2 mb-10 transition-all duration-1000 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                handleUserInteraction(step.id);
                track('how_it_works_tab_clicked', { step: step.id, label: step.tabLabel });
              }}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm sm:text-base transition-all duration-300
                ${activeStep === step.id
                  ? 'bg-gray-900 text-white shadow-depth-lg'
                  : 'bg-white text-text-body hover:bg-gray-100 shadow-depth-sm border border-gray-200'
                }
              `}
            >
              {step.icon}
              <span>{step.tabLabel}</span>
            </button>
          ))}
        </div>

        {/* Content Area - Two Column Layout */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

          {/* Left: Large Screenshot */}
          <div className="relative">
            <div className="bg-gray-900 rounded-2xl p-4 sm:p-6 shadow-depth-2xl">
              {/* Header bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="text-white">{activeStepData.icon}</div>
                <span className="text-white font-medium">{activeStepData.tabLabel}</span>
              </div>

              {/* Screenshot */}
              {activeStepData.image ? (
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-800">
                  <Image
                    src={activeStepData.image}
                    alt={activeStepData.title}
                    fill
                    className="object-cover transition-opacity duration-500"
                    priority
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] rounded-xl bg-gray-800 flex items-center justify-center">
                  <div className="text-gray-500 text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 opacity-50">{activeStepData.icon}</div>
                    <p>Screenshot coming soon</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Description */}
          <div className="flex flex-col justify-center py-4 lg:py-8">
            {/* Duration Badge - only show when duration is provided */}
            {activeStepData.duration && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-full text-sm font-bold text-text-body w-fit mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {activeStepData.duration}
              </div>
            )}

            {/* Title */}
            <h3 className="text-3xl sm:text-4xl font-display font-bold text-text-dark mb-4 leading-tight">
              {activeStepData.title}
            </h3>

            {/* Description */}
            <p className="text-lg text-text-body mb-8 leading-relaxed">
              {activeStepData.description}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signup"
                onClick={() => track('cta_clicked', { placement: 'how_it_works', action: 'signup', step: activeStep })}
                className="inline-flex items-center justify-center px-6 py-3 bg-brand-cta text-white font-bold rounded-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-md hover:shadow-depth-lg hover:-translate-y-0.5"
              >
                {t('tryForFree')}
              </Link>
              <Link
                href="https://calendly.com/teamshotspro/demo"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('cta_clicked', { placement: 'how_it_works', action: 'book_demo', step: activeStep })}
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-text-dark font-bold rounded-xl border-2 border-gray-200 hover:border-brand-primary hover:text-brand-primary transition-all duration-300"
              >
                {t('bookDemo')}
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-col gap-1.5 text-sm text-text-muted mt-4">
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t('freePhotosLine')}</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>{t('noCreditCardLine')}</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
