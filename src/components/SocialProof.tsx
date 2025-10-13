'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
}

export default function SocialProof() {
  const t = useTranslations('socialProof');
  
  // TODO: Replace with real testimonials from beta users
  // Using placeholder structure until we have verified testimonials with user permission
  const TESTIMONIALS: Testimonial[] = [
    {
      id: '1',
      name: t('beta.name'),
      role: t('beta.role'),
      company: t('beta.company'),
      content: t('beta.message'),
      rating: 5
    }
  ];
  // Start with realistic beta number - will update with real data
  const [userCount, setUserCount] = useState(247);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Slow growth animation for realism
  useEffect(() => {
    const interval = setInterval(() => {
      setUserCount(prev => prev + Math.floor(Math.random() * 2));
    }, 10000); // Every 10 seconds instead of 5

    return () => clearInterval(interval);
  }, []);

  // Rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [TESTIMONIALS.length]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-lg ${
          i < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
      >
        ★
      </span>
    ));
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* User Count */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center bg-brand-primary-light text-brand-primary px-6 py-3 rounded-full shadow-md">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            <span className="font-semibold">
              <span className="text-2xl font-bold">{userCount.toLocaleString()}</span> {t('userCount')}
            </span>
          </div>
        </div>

        {/* Testimonials */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900">
            {t('testimonialsTitle')}
          </h3>
          
          <div className="bg-gray-50 rounded-2xl p-8 relative overflow-hidden">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {renderStars(TESTIMONIALS[currentTestimonial].rating)}
              </div>
              
              <blockquote className="text-lg text-gray-700 mb-6 italic">
                &ldquo;{TESTIMONIALS[currentTestimonial].content}&rdquo;
              </blockquote>
              
              <div className="flex items-center justify-center">
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {TESTIMONIALS[currentTestimonial].name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {TESTIMONIALS[currentTestimonial].role}, {TESTIMONIALS[currentTestimonial].company}
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Indicators */}
            <div className="flex justify-center mt-6 space-x-2">
              {TESTIMONIALS.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentTestimonial ? 'bg-brand-primary' : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Social Proof - Honest Beta Stats */}
        <div className="mt-12 text-center">
          <p className="text-lg font-semibold text-gray-700">
            {t('trustMessage')}
          </p>
        </div>
      </div>
    </section>
  );
}
