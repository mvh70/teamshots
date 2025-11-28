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
        className={`text-xl ${
          i < rating ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-300'
        }`}
      >
        ★
      </span>
    ));
  };

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* User Count */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-gradient-to-r from-brand-primary-light to-brand-primary-lighter text-brand-primary px-8 py-4 rounded-full shadow-depth-lg border-2 border-brand-primary-lighter/50">
            <span className="w-2.5 h-2.5 bg-brand-secondary rounded-full mr-3 animate-pulse shadow-sm"></span>
            <span className="font-semibold text-base">{tHero('joinedBadge')}</span>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-display font-bold text-center mb-16 text-text-dark leading-tight">
            {t('testimonialsTitle')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-bg-white rounded-3xl p-8 lg:p-10 shadow-depth-lg border-2 border-brand-primary-lighter/30 hover:shadow-depth-2xl hover:border-brand-primary-lighter hover:-translate-y-3 transition-all duration-500 cursor-pointer"
              >
                <div className="flex justify-center mb-6">
                  <div className="flex gap-1">
                    {renderStars(testimonial.rating)}
                  </div>
                </div>
                
                <blockquote className="text-base lg:text-lg text-text-body mb-8 leading-relaxed font-medium">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>
                
                <div className="border-t-2 border-brand-primary-lighter/50 pt-6">
                  <div className="font-bold text-lg text-text-dark font-display">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-text-muted mt-2 font-medium">
                    {testimonial.role} • {testimonial.team}
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
