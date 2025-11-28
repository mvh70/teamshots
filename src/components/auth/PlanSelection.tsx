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
      <div className="text-center mb-7">
        <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
          Choose your plan
        </h3>
        <p className="text-sm text-slate-600 font-medium">
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
              group relative p-6 rounded-xl border-2 transition-all duration-200
              min-h-[150px] text-left
              ${selectedPlan === plan.id
                ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg ring-2 ring-blue-500/20'
                : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-md hover:bg-slate-50/50'
              }
            `}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md">
                  Most Popular
                </div>
              </div>
            )}

            {/* Selection indicator */}
            {selectedPlan === plan.id && (
              <div className="absolute top-5 right-5 w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-4xl flex-shrink-0 mt-0.5">
                {plan.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-slate-900 mb-1.5 tracking-tight">
                  {plan.title}
                </h4>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  {plan.description}
                </p>

                {/* Benefits list */}
                <ul className="space-y-2">
                  {plan.benefits.map((benefit, index) => (
                    <li key={index} className="text-xs text-slate-600 flex items-center gap-2.5 font-medium">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Hover state indicator */}
            <div className={`
              absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none
              ${selectedPlan === plan.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-5'}
              bg-blue-500
            `} />
          </button>
        ))}
      </div>

      {/* Mobile-specific hint */}
      <div className="mt-5 text-center">
        <p className="text-xs text-slate-500 font-medium">
          💡 You can change your plan anytime
        </p>
      </div>
    </div>
  )
}
