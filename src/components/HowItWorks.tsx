'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

interface Step {
  id: number;
  icon: string;
  title: string;
  description: string;
  duration: string;
}

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const [activeStep, setActiveStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

  const STEPS: Step[] = [
    {
      id: 1,
      icon: '📸',
      title: t('steps.1.title'),
      description: t('steps.1.description'),
      duration: t('steps.1.duration')
    },
    {
      id: 2,
      icon: '🤖',
      title: t('steps.2.title'),
      description: t('steps.2.description'),
      duration: t('steps.2.duration')
    },
    {
      id: 3,
      icon: '✨',
      title: t('steps.3.title'),
      description: t('steps.3.description'),
      duration: t('steps.3.duration')
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
          {/* Progress Line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0">
            <div 
              className={`h-full bg-brand-primary transition-all duration-1000 ease-out ${
                isVisible ? 'w-full' : 'w-0'
              }`}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
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
                {/* Step Number Circle */}
                <div className="relative mb-6">
                  <div 
                    className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 ${
                      activeStep === step.id
                        ? 'bg-brand-primary text-white scale-110 shadow-lg'
                        : 'bg-white text-gray-600 border-4 border-gray-200'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    {step.duration}
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

        {/* Total Time */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center bg-brand-primary-light text-brand-primary px-6 py-3 rounded-full">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">
              {t('totalTime')} <span className="text-2xl font-bold">{t('totalTimeValue')}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
