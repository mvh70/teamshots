'use client';

import { useTranslations } from 'next-intl'
import { CardGrid } from '@/components/ui'
import type { LandingVariant, LandingSections } from '@/config/landing-content'

interface TrustBadge {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Section key to check for visibility */
  sectionKey?: keyof LandingSections;
}

interface TrustIndicatorsProps {
  /** Landing page variant for domain-specific content */
  variant: LandingVariant;
  /** Function to check if a section should be shown */
  showSection: (section: keyof LandingSections) => boolean;
}

export default function TrustIndicators({ variant, showSection }: TrustIndicatorsProps) {
  // Use domain-specific translations
  const t = useTranslations(`landing.${variant}.trust`);
  
  // Build trust badges based on variant
  // Each badge can be conditionally shown based on section visibility
  const TRUST_BADGES: TrustBadge[] = [
    // No Model Training - unique quality approach (shown for team-focused domains)
    ...(showSection('showTeamCommandCenter') ? [{
      id: 'noModelTraining',
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: t('badges.noModelTraining.title'),
      description: t('badges.noModelTraining.description'),
      sectionKey: 'showTeamCommandCenter' as keyof LandingSections,
    }] : []),
    // Team Command Center - only shown for team-focused domains
    ...(showSection('showTeamCommandCenter') ? [{
      id: 'teamCommandCenter',
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: t('badges.teamCommandCenter.title'),
      description: t('badges.teamCommandCenter.description'),
      sectionKey: 'showTeamCommandCenter' as keyof LandingSections,
    }] : []),
    // Industry Templates - shown for all domains (with different content per domain)
    ...(showSection('showIndustryTemplates') ? [{
      id: 'industryTemplates',
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
        </svg>
      ),
      title: t('badges.industryTemplates.title'),
      description: t('badges.industryTemplates.description'),
      sectionKey: 'showIndustryTemplates' as keyof LandingSections,
    }] : []),
    // Quality Control - always shown
    {
      id: 'qualityControl',
      icon: (
        <svg className="w-8 h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t('badges.qualityControl.title'),
      description: t('badges.qualityControl.description'),
    }
  ];

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h3 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
            {t('title')}
          </h3>
          <p className="text-lg sm:text-xl lg:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        <CardGrid gap="lg" className="max-w-6xl mx-auto">
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.id}
              className="group bg-bg-white rounded-3xl p-8 lg:p-10 xl:p-12 text-center shadow-depth-lg hover:shadow-depth-2xl transition-all duration-500 border-2 border-brand-primary-lighter/30 hover:border-brand-primary-lighter hover:-translate-y-3 cursor-pointer"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 bg-brand-primary-light rounded-2xl flex items-center justify-center mb-8 group-hover:bg-brand-primary group-hover:scale-110 transition-all duration-500 shadow-depth-md group-hover:shadow-depth-xl group-hover:shadow-brand-primary/20">
                <div className="text-brand-primary group-hover:text-white transition-colors duration-500">
                  {badge.icon}
                </div>
              </div>
              <h4 className="font-bold text-text-dark mb-5 text-xl lg:text-2xl xl:text-3xl font-display leading-tight">
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
