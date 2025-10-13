'use client';

import { useTranslations } from 'next-intl';

interface TrustBadge {
  icon: string;
  title: string;
  description: string;
}

export default function TrustIndicators() {
  const t = useTranslations('trust');
  
  // Simplified to 2 most impactful trust indicators per expert UX analysis
  const TRUST_BADGES: TrustBadge[] = [
    {
      icon: '🔒',
      title: t('badges.security.title'),
      description: t('badges.security.description')
    },
    {
      icon: '🤖',
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
              <div className="text-5xl mb-4">{badge.icon}</div>
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
