'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  duration: string;
  effort: string;
}

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const [activeStep, setActiveStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

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
      duration: t('steps.1.duration'),
      effort: t('steps.1.effort')
    },
    {
      id: 2,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      title: t('steps.2.title'),
      description: t('steps.2.description'),
      duration: t('steps.2.duration'),
      effort: t('steps.2.effort')
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
      duration: t('steps.3.duration'),
      effort: t('steps.3.effort')
    },
    {
      id: 4,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: t('steps.4.title'),
      description: t('steps.4.description'),
      duration: t('steps.4.duration'),
      effort: t('steps.4.effort')
    },
    {
      id: 5,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      title: t('steps.5.title'),
      description: t('steps.5.description'),
      duration: t('steps.5.duration'),
      effort: t('steps.5.effort')
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    const element = document.getElementById('how-it-works');
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="relative">
          {/* Progress Line - positioned to connect step circles */}
          <div className="hidden md:block absolute top-[60px] left-[10%] right-[10%] h-1 bg-gray-200 z-0">
            <div 
              className={`h-full bg-brand-primary transition-all duration-1000 ease-out ${
                isVisible ? 'w-full' : 'w-0'
              }`}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`text-center transform transition-all duration-700 delay-${index * 200} ${
                  isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-8'
                }`}
                onMouseEnter={() => setActiveStep(step.id)}
              >
                {/* Step Icon Circle */}
                <div className="relative mb-6">
                  <div 
                    className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                      activeStep === step.id
                        ? 'bg-brand-primary text-white scale-110 shadow-xl shadow-brand-primary/25'
                        : 'bg-white text-brand-primary border-4 border-brand-primary-light shadow-lg'
                    }`}
                  >
                    {step.icon}
                  </div>
                  
                  {/* Duration Badge */}
                  <div className={`absolute -top-3 -right-3 px-3 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${
                    activeStep === step.id
                      ? 'bg-brand-cta text-white shadow-lg'
                      : 'bg-brand-secondary text-white'
                  }`}>
                    {step.duration}
                  </div>
                  
                  {/* Effort Indicator */}
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="bg-brand-primary-light text-brand-primary px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                      {step.effort}
                    </div>
                  </div>
                </div>

                {/* Step Content */}
                <h3 
                  className={`text-xl font-semibold mb-3 transition-colors duration-300 ${
                    activeStep === step.id ? 'text-brand-primary' : 'text-gray-900'
                  }`}
                >
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Results Preview & CTA */}
        <div className="text-center mt-16">
          {/* Total Time Highlight */}
          <div className="inline-flex items-center bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white px-8 py-4 rounded-full shadow-xl mb-8">
            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-lg font-semibold">
              {t('totalTime')} <span className="text-3xl font-bold ml-2">{t('totalTimeValue')}</span>
            </span>
          </div>
          
          {/* CTA Button */}
          <div className="space-y-4">
            <button className="bg-brand-cta text-white px-10 py-5 rounded-xl font-bold text-xl hover:bg-brand-cta-hover transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1">
              {t('cta')}
            </button>
            <p className="text-sm text-gray-500">
              {t('guarantee')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
