'use client'

import { useTranslations } from 'next-intl'

type OutcomeType = 'ats' | 'branding' | 'linkedin' | 'portfolio' | 'speaking' | null

interface OutcomeSelectionProps {
  segment: 'organizer' | 'individual' | 'invited'
  onOutcomeSelect: (outcome: string) => void
  selectedOutcome?: OutcomeType
  className?: string
}

export function OutcomeSelection({
  segment,
  onOutcomeSelect,
  selectedOutcome,
  className = ''
}: OutcomeSelectionProps) {
  const t = useTranslations('app')

  const getOutcomesForSegment = (segment: string) => {
    switch (segment) {
      case 'organizer':
        return [
          {
            id: 'ats' as const,
            title: 'ATS Optimization',
            description: 'Standardize photos for applicant tracking systems',
            icon: '🎯',
            benefits: ['Higher profile visibility', 'Consistent branding', 'Professional appearance']
          },
          {
            id: 'branding' as const,
            title: 'Brand Consistency',
            description: 'Create cohesive team photos for marketing materials',
            icon: '🎨',
            benefits: ['Unified company image', 'Stronger brand identity', 'Professional marketing']
          }
        ]
      case 'individual':
        return [
          {
            id: 'linkedin' as const,
            title: 'LinkedIn Upgrade',
            description: 'Professional headshots that boost your profile',
            icon: '💼',
            benefits: ['Higher profile views', 'Credibility boost', 'Professional networking']
          },
          {
            id: 'portfolio' as const,
            title: 'Portfolio Enhancement',
            description: 'High-quality photos for your creative work',
            icon: '📸',
            benefits: ['Showcase your best work', 'Professional presentation', 'Client attraction']
          }
        ]
      case 'invited':
        return [
          {
            id: 'team' as const,
            title: 'Team Consistency',
            description: 'Match your team\'s professional photo style',
            icon: '👥',
            benefits: ['Unified team appearance', 'Company branding', 'Professional image']
          }
        ]
      default:
        return []
    }
  }

  const outcomes = getOutcomesForSegment(segment)

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`} id="outcome-selection">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('onboarding.outcomeSelection.title')}
        </h2>
        <p className="text-gray-600">
          {t('onboarding.outcomeSelection.subtitle')}
        </p>
      </div>

      {/* Mobile: Single column stack */}
      <div className="grid grid-cols-1 gap-6">
        {outcomes.map((outcome) => (
          <button
            key={outcome.id}
            onClick={() => onOutcomeSelect(outcome.id)}
            className={`
              group relative p-6 rounded-2xl border-2 transition-all duration-200
              min-h-[120px] text-left
              ${selectedOutcome === outcome.id
                ? 'border-brand-primary bg-brand-primary/5 shadow-lg'
                : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
              }
            `}
          >
            {/* Selection indicator */}
            {selectedOutcome === outcome.id && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-3xl flex-shrink-0 mt-1">
                {outcome.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {outcome.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {outcome.description}
                </p>

                {/* Benefits list */}
                <ul className="space-y-1">
                  {outcome.benefits.map((benefit, index) => (
                    <li key={index} className="text-xs text-gray-500 flex items-center gap-2">
                      <div className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Hover state indicator */}
            <div className={`
              absolute inset-0 rounded-2xl transition-opacity duration-200 pointer-events-none
              ${selectedOutcome === outcome.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-10'}
              bg-brand-primary
            `} />
          </button>
        ))}
      </div>

      {/* Mobile-specific hint */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          👆 Choose what success looks like for you
        </p>
      </div>
    </div>
  )
}
