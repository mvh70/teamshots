'use client';

import { useTranslations } from 'next-intl'
import { CardGrid } from '@/components/ui'

interface TrustBadge {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function TrustIndicators() {
  const t = useTranslations('trust');
  
  // Focused on unique, differentiating trust indicators
  const TRUST_BADGES: TrustBadge[] = [
    {
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: t('badges.teamCommandCenter.title'),
      description: t('badges.teamCommandCenter.description')
    },
    {
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
        </svg>
      ),
      title: t('badges.industryTemplates.title'),
      description: t('badges.industryTemplates.description')
    },
    {
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('badges.qualityControl.title'),
      description: t('badges.qualityControl.description')
    }
  ];

  return (
    <section className="py-20 lg:py-32 bg-bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h3 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6">
            {t('title')}
          </h3>
          <p className="text-xl text-text-body max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        <CardGrid gap="lg" className="max-w-6xl mx-auto">
          {TRUST_BADGES.map((badge, index) => (
            <div
              key={index}
              className="group bg-bg-white rounded-3xl p-8 lg:p-10 text-center shadow-depth-md hover:shadow-depth-xl transition-all duration-500 border-2 border-transparent hover:border-brand-primary-lighter hover:-translate-y-2"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-sm group-hover:shadow-depth-md">
                <div className="text-brand-primary group-hover:text-white transition-colors duration-500">
                  {badge.icon}
                </div>
              </div>
              <h4 className="font-bold text-text-dark mb-4 text-xl lg:text-2xl font-display">
                {badge.title}
              </h4>
              <p className="text-base lg:text-lg text-text-body leading-relaxed">
                {badge.description}
              </p>
            </div>
          ))}
        </CardGrid>
      </div>
    </section>
  );
}
