'use client'

import { useTranslations } from 'next-intl'

interface OnboardingBenefitsProps {
  className?: string
}

export function OnboardingBenefits({ className = '' }: OnboardingBenefitsProps) {
  const t = useTranslations('app.onboarding.benefits')

  const benefits = [
    {
      icon: '⚡',
      key: 'noScheduling',
      description: t('noScheduling.description')
    },
    {
      icon: '💰',
      key: 'lowerCost',
      description: t('lowerCost.description')
    },
    {
      icon: '⏱️',
      key: 'instantResults',
      description: t('instantResults.description')
    },
    {
      icon: '🔄',
      key: 'freeRetries',
      description: t('freeRetries.description')
    }
  ]

  return (
    <div className={`mt-8 ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {benefits.map((benefit) => (
          <div
            key={benefit.key}
            className="flex flex-col items-center text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">{benefit.icon}</div>
            <p className="text-sm font-medium text-gray-900 leading-tight">
              {benefit.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
