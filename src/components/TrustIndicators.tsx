'use client';

import { useTranslations } from 'next-intl';

interface TrustBadge {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function TrustIndicators() {
  const t = useTranslations('trust');
  
  // Simplified to 2 most impactful trust indicators per expert UX analysis
  const TRUST_BADGES: TrustBadge[] = [
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: t('badges.security.title'),
      description: t('badges.security.description')
    },
    {
      icon: (
        <svg className="w-12 h-12 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: t('badges.ai.title'),
      description: t('badges.ai.description')
    }
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('title')}
          </h3>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
