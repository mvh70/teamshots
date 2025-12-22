'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { LandingVariant } from '@/config/landing-content';

interface Step {
  id: number;
  icon: React.ReactNode;
  image?: string;
  title: string;
  description: string;
  duration: string;
}

// Step icons - reusable across variants
const STEP_ICONS = {
  upload: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  team: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  customize: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  sliders: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
    </svg>
  ),
  paperPlane: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  mobilePhone: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  downloadFolder: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  check: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

// Icon mapping per variant and step
const VARIANT_ICONS: Record<LandingVariant, Record<number, React.ReactNode>> = {
  teamshotspro: {
    1: STEP_ICONS.sliders,
    2: STEP_ICONS.paperPlane,
    3: STEP_ICONS.mobilePhone,
    4: STEP_ICONS.downloadFolder,
  },
  photoshotspro: {
    1: STEP_ICONS.upload,
    2: STEP_ICONS.customize,
    3: STEP_ICONS.sparkle,
  },
  coupleshotspro: {
    1: STEP_ICONS.upload,
    2: STEP_ICONS.customize,
    3: STEP_ICONS.sparkle,
  },
};

// Step images for TeamShotsPro
const VARIANT_IMAGES: Record<LandingVariant, Record<number, string>> = {
  teamshotspro: {
    1: '/images/how-it-works/step-1-v2.png',
    2: '/images/how-it-works/step-2-v3.png',
    3: '/images/how-it-works/step-3-v2.png',
    4: '/images/how-it-works/step-4-v2.png',
  },
  photoshotspro: {},
  coupleshotspro: {},
};

interface HowItWorksProps {
  /** Landing page variant for domain-specific content */
  variant: LandingVariant;
}

export default function HowItWorks({ variant }: HowItWorksProps) {
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.howItWorks`);
  const [activeStep, setActiveStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const { track } = useAnalytics();

  // Build steps dynamically based on variant
  const STEPS: Step[] = useMemo(() => {
    const icons = VARIANT_ICONS[variant] || VARIANT_ICONS.teamshotspro;
    const images = VARIANT_IMAGES[variant] || {};
    const stepCount = variant === 'teamshotspro' ? 4 : 3;

    return Array.from({ length: stepCount }, (_, i) => {
      const stepNum = i + 1;
      return {
        id: stepNum,
        icon: icons[stepNum] || STEP_ICONS.check,
        image: images[stepNum],
        title: t(`steps.${stepNum}.title`),
        description: t(`steps.${stepNum}.description`),
        duration: t(`steps.${stepNum}.duration`),
      };
    });
  }, [variant, t]);

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

  // Determine grid columns class based on step count
  // Using explicit class strings so Tailwind detects them
  const gridColsClass = STEPS.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';

  return (
    <section id="how-it-works" className="py-24 sm:py-32 bg-bg-gray-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-3xl translate-y-1/3" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className={`text-center mb-20 md:mb-28 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6 leading-[1.1]">
            {t('title')}
          </h2>
          <p className="text-lg md:text-xl text-text-body max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Dynamic Timeline Steps */}
        <div className="relative">

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-6">
            {STEPS.map((step, index) => (
              <Fragment key={step.id}>
                <div
                  className={`group relative flex flex-col items-center text-center transition-all duration-700 flex-1 max-w-sm ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                    }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                  onMouseEnter={() => setActiveStep(step.id)}
                >

                  {/* Card Container */}
                  <div className={`
                  w-full bg-bg-white rounded-2xl relative overflow-hidden
                  border border-gray-100
                  transition-all duration-500 ease-out flex flex-col
                  ${activeStep === step.id
                      ? 'shadow-depth-xl -translate-y-2 ring-1 ring-brand-primary/20'
                      : 'shadow-depth-md hover:shadow-depth-lg hover:-translate-y-1'
                    }
                `}>
                    {step.image ? (
                      <div className="w-full aspect-[4/3] relative overflow-hidden bg-gray-50 border-b border-gray-100">
                        <Image
                          src={step.image}
                          alt={step.title}
                          fill
                          className={`object-cover transition-transform duration-700 ${activeStep === step.id ? 'scale-105' : 'scale-100 group-hover:scale-105'
                            }`}
                        />
                        {/* Interaction Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-bg-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>
                    ) : (
                      /* Icon Area for non-image variants */
                      <div className={`
                      w-16 h-16 mx-auto mt-8 mb-2 rounded-2xl flex items-center justify-center p-3.5
                      transition-all duration-500
                      ${activeStep === step.id
                          ? 'bg-gradient-to-br from-brand-primary to-brand-primary-hover text-bg-white shadow-depth-lg shadow-brand-primary/25 rotate-3'
                          : 'bg-bg-gray-50 text-text-muted group-hover:bg-brand-primary/5 group-hover:text-brand-primary group-hover:-rotate-3'
                        }
                    `}>
                        {step.icon}
                      </div>
                    )}

                    {/* Text Content */}
                    <div className="p-6 xl:p-8 pt-6 flex-grow flex flex-col items-center">
                      <h3 className={`text-xl font-bold mb-3 font-display transition-colors duration-300 ${activeStep === step.id ? 'text-text-dark' : 'text-text-body'}`}>
                        {step.title}
                      </h3>

                      <p className="text-text-muted leading-relaxed text-sm md:text-base mb-6">
                        {step.description}
                      </p>

                      {/* Duration Capsule */}
                      <div className={`
                      mt-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide
                      transition-colors duration-300
                      ${activeStep === step.id
                          ? 'bg-brand-secondary/10 text-brand-secondary-text'
                          : 'bg-gray-100 text-text-muted'
                        }
                    `}>
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {step.duration}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Arrow between steps - hidden on mobile, shown on desktop */}
                {index < STEPS.length - 1 && (
                  <div className={`hidden md:flex items-center justify-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                    }`}
                    style={{ transitionDelay: `${(index + 1) * 150}ms` }}
                  >
                    <svg
                      className="w-12 h-12 text-brand-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className={`mt-20 md:mt-24 text-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
          <div className="bg-bg-white p-1 rounded-2xl inline-block shadow-depth-xl shadow-gray-200/50">
            <div className="bg-bg-gray-50 rounded-xl px-8 py-10 sm:px-12 sm:py-12 border border-gray-100/50">
              <div className="flex flex-col md:flex-row items-center gap-8 justify-center">

                {/* Total Time */}
                <div className="flex flex-col items-center md:items-end">
                  <span className="text-text-muted text-sm font-medium uppercase tracking-wider mb-1">{t('totalTime')}</span>
                  <span className="text-3xl font-display font-bold text-text-dark">{t('totalTimeValue')}</span>
                </div>

                <div className="hidden md:block w-px h-16 bg-gray-200"></div>

                {/* Primary Action */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                  <Link
                    href="/auth/signup"
                    onClick={() =>
                      track('cta_clicked', {
                        placement: 'how_it_works',
                        action: 'signup',
                      })
                    }
                    className="inline-flex items-center justify-center px-8 py-4 bg-brand-cta text-bg-white font-bold text-lg rounded-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-lg hover:shadow-depth-xl hover:-translate-y-1 focus:ring-4 focus:ring-brand-cta/20"
                  >
                    <span>{t('cta')}</span>
                    <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
