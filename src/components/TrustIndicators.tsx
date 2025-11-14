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
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: t('badges.teamCommandCenter.title'),
      description: t('badges.teamCommandCenter.description')
    },
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
        </svg>
      ),
      title: t('badges.industryTemplates.title'),
      description: t('badges.industryTemplates.description')
    },
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('badges.qualityControl.title'),
      description: t('badges.qualityControl.description')
    }
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h3>
          <p className="text-gray-600 text-lg">
            {t('subtitle')}
          </p>
        </div>

        <CardGrid gap="lg" className="max-w-6xl mx-auto">
          {TRUST_BADGES.map((badge, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 text-center shadow-md hover:shadow-lg transition-all duration-300 border-2 border-gray-100 hover:border-brand-primary/20"
            >
              <div className="w-16 h-16 bg-brand-primary-light rounded-lg flex items-center justify-center mb-4">
                {badge.icon}
              </div>
              <h4 className="font-bold text-gray-900 mb-3 text-lg">
                {badge.title}
              </h4>
              <p className="text-base text-gray-600 leading-relaxed">
                {badge.description}
              </p>
            </div>
          ))}
        </CardGrid>
      </div>
    </section>
  );
}
