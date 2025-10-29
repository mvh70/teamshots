'use client';

import { useTranslations } from 'next-intl';

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('badges.noWatermarks.title'),
      description: t('badges.noWatermarks.description')
    },
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: t('badges.instant.title'),
      description: t('badges.instant.description')
    },
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: t('badges.teamManagement.title'),
      description: t('badges.teamManagement.description')
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
        </div>
      </div>
    </section>
  );
}
