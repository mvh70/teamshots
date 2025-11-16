'use client'

import { useTranslations } from 'next-intl'

type PlanType = 'individual' | 'team'

interface PlanSelectionProps {
  selectedPlan: PlanType
  onPlanSelect: (plan: PlanType) => void
  className?: string
}

export function PlanSelection({ selectedPlan, onPlanSelect, className = '' }: PlanSelectionProps) {
  const t = useTranslations('auth.signup')

  const plans = [
    {
      id: 'individual' as const,
      title: t('individual'),
      description: t('individualDesc'),
      icon: '👤',
      benefits: [
        'Perfect for personal branding',
        'LinkedIn and portfolio photos',
        'Professional headshots'
      ],
      popular: false
    },
    {
      id: 'team' as const,
      title: t('team'),
      description: t('teamDesc'),
      icon: '👥',
      benefits: [
        'Team photo consistency',
        'Company branding',
        'HR and talent teams'
      ],
      popular: true
    }
  ]

  return (
    <div className={`w-full ${className}`}>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose your plan
        </h3>
        <p className="text-sm text-gray-600">
          Select the option that best fits your needs
        </p>
      </div>

      {/* Mobile: Single column stack */}
      <div className="grid grid-cols-1 gap-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onPlanSelect(plan.id)}
            className={`
              group relative p-5 rounded-xl border-2 transition-all duration-200
              min-h-[140px] text-left
              ${selectedPlan === plan.id
                ? 'border-brand-primary bg-brand-primary/5 shadow-lg'
                : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
              }
            `}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-brand-primary text-white px-3 py-1 rounded-full text-xs font-medium shadow-sm">
                  Most Popular
                </div>
              </div>
            )}

            {/* Selection indicator */}
            {selectedPlan === plan.id && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-3xl flex-shrink-0 mt-1">
                {plan.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                  {plan.title}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {plan.description}
                </p>

                {/* Benefits list */}
                <ul className="space-y-1">
                  {plan.benefits.map((benefit, index) => (
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
              absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none
              ${selectedPlan === plan.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-10'}
              bg-brand-primary
            `} />
          </button>
        ))}
      </div>

      {/* Mobile-specific hint */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          💡 You can change your plan anytime
        </p>
      </div>
    </div>
  )
}
