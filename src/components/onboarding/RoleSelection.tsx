'use client'

import { useTranslations } from 'next-intl'

type UserRole = 'organizer' | 'individual' | null

interface RoleSelectionProps {
  onRoleSelect: (role: 'organizer' | 'individual') => void
  selectedRole?: UserRole
  className?: string
}

export function RoleSelection({ onRoleSelect, selectedRole, className = '' }: RoleSelectionProps) {
  const t = useTranslations('app')

  const roles = [
    {
      id: 'organizer' as const,
      title: t('onboarding.roleSelection.organizer.title'),
      description: t('onboarding.roleSelection.organizer.description'),
      icon: '👥',
      benefits: [
        'Save hours on photo management',
        'Ensure team consistency',
        'Professional branding'
      ]
    },
    {
      id: 'individual' as const,
      title: t('onboarding.roleSelection.individual.title'),
      description: t('onboarding.roleSelection.individual.description'),
      icon: '👤',
      benefits: [
        'Upgrade LinkedIn presence',
        'Portfolio enhancement',
        'Professional headshots'
      ]
    }
  ]

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`} id="role-selection">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('onboarding.roleSelection.title')}
        </h2>
        <p className="text-gray-600">
          {t('onboarding.roleSelection.subtitle')}
        </p>
      </div>

      {/* Mobile: Single column stack, Desktop: Side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => onRoleSelect(role.id)}
            className={`
              group relative p-6 rounded-2xl border-2 transition-all duration-200
              min-h-[120px] text-left
              ${selectedRole === role.id
                ? 'border-brand-primary bg-brand-primary/5 shadow-lg'
                : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
              }
            `}
          >
            {/* Selection indicator */}
            {selectedRole === role.id && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-3xl flex-shrink-0 mt-1">
                {role.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {role.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {role.description}
                </p>

                {/* Benefits list */}
                <ul className="space-y-1">
                  {role.benefits.map((benefit, index) => (
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
              ${selectedRole === role.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-10'}
              bg-brand-primary
            `} />
          </button>
        ))}
      </div>

      {/* Mobile-specific hint */}
      <div className="mt-6 text-center md:hidden">
        <p className="text-sm text-gray-500">
          👆 Tap to select your role
        </p>
      </div>
    </div>
  )
}
