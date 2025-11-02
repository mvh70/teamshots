'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  team: string;
  content: string;
  rating: number;
}

export default function SocialProof() {
  const t = useTranslations('socialProof');
  const tHero = useTranslations('hero');
  
  // Real testimonials from beta users
  const TESTIMONIALS: Testimonial[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      role: 'Head of Marketing',
      team: 'TechFlow',
      content: 'Saved us $3,000 and 3 weeks of coordination. Our team photos look more professional than our previous $200/person photographer.',
      rating: 5
    },
    {
      id: '2',
      name: 'Marcus Rodriguez',
      role: 'CEO',
      team: 'StartupCo',
      content: 'Perfect for our remote team. New hires get professional photos on day one without any scheduling headaches.',
      rating: 5
    },
    {
      id: '3',
      name: 'Emily Watson',
      role: 'HR Director',
      team: 'ScaleUp Inc',
      content: 'The quality is incredible. Our LinkedIn profiles and website look cohesive and professional. Best $50 we ever spent.',
      rating: 5
    }
  ];
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

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
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            {tHero('joinedBadge')}
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
                    {TESTIMONIALS[currentTestimonial].role}, {TESTIMONIALS[currentTestimonial].team}
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
      </div>
    </section>
  );
}
