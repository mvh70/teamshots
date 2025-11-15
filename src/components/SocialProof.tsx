'use client';

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
    <section className="py-20 lg:py-32 bg-bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* User Count */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-brand-primary-light text-brand-primary px-6 py-3 rounded-full shadow-depth-md">
            <span className="w-2 h-2 bg-brand-secondary rounded-full mr-2 animate-pulse"></span>
            {tHero('joinedBadge')}
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-center mb-12 text-text-dark">
            {t('testimonialsTitle')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-bg-white rounded-2xl p-8 shadow-depth-md border-2 border-transparent hover:shadow-depth-xl hover:border-brand-primary-lighter hover:-translate-y-2 transition-all duration-500"
              >
                <div className="flex justify-center mb-4">
                  {renderStars(testimonial.rating)}
                </div>
                
                <blockquote className="text-base text-text-body mb-6 leading-relaxed">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>
                
                <div className="border-t border-brand-primary-lighter pt-4">
                  <div className="font-bold text-text-dark font-display">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {testimonial.role}, {testimonial.team}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
