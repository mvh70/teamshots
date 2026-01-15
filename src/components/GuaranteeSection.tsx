'use client';

import { useTranslations } from 'next-intl';
import type { LandingVariant } from '@/config/landing-content';

interface GuaranteeSectionProps {
  variant: LandingVariant;
}

export default function GuaranteeSection({ variant }: GuaranteeSectionProps) {
  const t = useTranslations(`landing.${variant}.guarantee`);

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-br from-brand-primary-light via-bg-white to-brand-secondary-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-3xl shadow-depth-2xl p-8 sm:p-12 border-4 border-brand-primary">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-primary-hover rounded-full mb-6 shadow-depth-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6">
            {t('title')}
          </h3>
          <p className="text-lg sm:text-xl text-text-body leading-relaxed mb-4">
            {t('subtitle')}
          </p>
          <p className="text-base sm:text-lg text-text-muted">
            {t('description')}
          </p>
        </div>
      </div>
    </section>
  );
}
