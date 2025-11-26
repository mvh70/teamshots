'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAnalytics } from '@/hooks/useAnalytics';

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  duration: string;
}

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const [activeStep, setActiveStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const { track } = useAnalytics();

  const STEPS: Step[] = [
    {
      id: 1,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      title: t('steps.1.title'),
      description: t('steps.1.description'),
      duration: t('steps.1.duration')
    },
    {
      id: 2,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: t('steps.2.title'),
      description: t('steps.2.description'),
      duration: t('steps.2.duration')
    },
    {
      id: 3,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      title: t('steps.3.title'),
      description: t('steps.3.description'),
      duration: t('steps.3.duration')
    },
    {
      id: 4,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('steps.4.title'),
      description: t('steps.4.description'),
      duration: t('steps.4.duration')
    },
    {
      id: 5,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      title: t('steps.5.title'),
      description: t('steps.5.description'),
      duration: t('steps.5.duration')
    }
  ];

  // Intersection observer for visibility animation - intentional client-only pattern
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
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
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-bg-gray-50 relative grain-texture">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20 lg:mb-24">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6 leading-tight">
            {t('title')}
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Steps Grid - 3 columns on desktop, wrapping naturally */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 mb-8">
            {STEPS.slice(0, 3).map((step, index) => (
              <div
                key={step.id}
                className={`group transform transition-all duration-700 delay-${index * 150} ${
                  isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-16'
                }`}
                onMouseEnter={() => setActiveStep(step.id)}
              >
                {/* Card with Enhanced Styling */}
                <div className={`
                  relative h-full bg-bg-white rounded-3xl p-8 
                  transition-all duration-500 cursor-pointer
                  ${activeStep === step.id
                    ? 'shadow-depth-2xl shadow-brand-primary/20 border-2 border-brand-primary transform scale-105'
                    : 'shadow-depth-lg border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2'
                  }
                `}>
                  {/* Icon Circle with Enhanced Styling */}
                  <div className="flex justify-center mb-6">
                    <div className={`
                      w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center
                      transition-all duration-500
                      ${activeStep === step.id
                        ? 'bg-brand-primary text-bg-white scale-110 shadow-depth-xl shadow-brand-primary/40'
                        : 'bg-brand-primary-light text-brand-primary group-hover:scale-110 group-hover:bg-brand-primary group-hover:text-bg-white group-hover:shadow-depth-lg shadow-depth-sm'
                      }
                    `}>
                      <div className="w-8 h-8 lg:w-10 lg:h-10">
                        {step.icon}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className={`
                    text-xl lg:text-2xl font-bold mb-4 text-center font-display
                    transition-colors duration-300
                    ${activeStep === step.id ? 'text-brand-primary' : 'text-text-dark'}
                  `}>
                    {step.title}
                  </h3>
                  
                  <p className="text-base lg:text-lg text-text-body text-center leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* Duration Badge - at bottom */}
                  <div className="flex justify-center">
                    <span className={`
                      inline-flex items-center text-sm font-semibold px-4 py-2 rounded-full
                      transition-all duration-300
                      ${activeStep === step.id
                        ? 'bg-brand-cta text-bg-white shadow-md'
                        : 'bg-brand-secondary text-bg-white'
                      }
                    `}>
                      {step.duration}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Second row - centered 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 max-w-4xl mx-auto">
            {STEPS.slice(3, 5).map((step, index) => (
              <div
                key={step.id}
                className={`group transform transition-all duration-700 delay-${(index + 3) * 150} ${
                  isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-16'
                }`}
                onMouseEnter={() => setActiveStep(step.id)}
              >
                {/* Card with Enhanced Styling */}
                <div className={`
                  relative h-full bg-bg-white rounded-3xl p-8 
                  transition-all duration-500 cursor-pointer
                  ${activeStep === step.id
                    ? 'shadow-depth-2xl shadow-brand-primary/20 border-2 border-brand-primary transform scale-105'
                    : 'shadow-depth-lg border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2'
                  }
                `}>
                  {/* Icon Circle with Enhanced Styling */}
                  <div className="flex justify-center mb-6">
                    <div className={`
                      w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center
                      transition-all duration-500
                      ${activeStep === step.id
                        ? 'bg-brand-primary text-bg-white scale-110 shadow-depth-xl shadow-brand-primary/40'
                        : 'bg-brand-primary-light text-brand-primary group-hover:scale-110 group-hover:bg-brand-primary group-hover:text-bg-white group-hover:shadow-depth-lg shadow-depth-sm'
                      }
                    `}>
                      <div className="w-8 h-8 lg:w-10 lg:h-10">
                        {step.icon}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className={`
                    text-xl lg:text-2xl font-bold mb-4 text-center font-display
                    transition-colors duration-300
                    ${activeStep === step.id ? 'text-brand-primary' : 'text-text-dark'}
                  `}>
                    {step.title}
                  </h3>
                  
                  <p className="text-base lg:text-lg text-text-body text-center leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* Duration Badge - at bottom */}
                  <div className="flex justify-center">
                    <span className={`
                      inline-flex items-center text-sm font-semibold px-4 py-2 rounded-full
                      transition-all duration-300
                      ${activeStep === step.id
                        ? 'bg-brand-cta text-bg-white shadow-md'
                        : 'bg-brand-secondary text-bg-white'
                      }
                    `}>
                      {step.duration}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20">
          {/* Total Time Badge */}
          <div className="inline-flex items-center bg-gradient-to-r from-brand-primary to-brand-primary-hover text-bg-white px-10 py-5 rounded-full shadow-depth-xl mb-10">
            <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-lg font-semibold">
              {t('totalTime')} <span className="text-3xl font-bold ml-3">{t('totalTimeValue')}</span>
            </span>
          </div>
          
          {/* CTA Button */}
          <div className="space-y-5">
            <Link
              href="/auth/signup"
              onClick={() =>
                track('cta_clicked', {
                  placement: 'how_it_works',
                  action: 'signup',
                })
              }
              className="inline-block bg-brand-cta text-bg-white px-14 py-6 rounded-xl font-bold text-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-depth-xl hover:shadow-depth-2xl transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('cta')}
            </Link>
            <p className="text-base lg:text-lg text-text-muted max-w-2xl mx-auto">
              {t('guarantee')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
