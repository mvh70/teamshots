'use client'

import { useTranslations } from 'next-intl'
import { User, UserCircle, Users } from 'lucide-react'
import { SELFIE_TYPE_REQUIREMENTS } from '@/domain/selfie/selfie-types'
import type { SelfieType, SelfieTypeRequirement } from '@/domain/selfie/selfie-types'

interface SelfieTypeSectionProps {
  className?: string
}

/**
 * Interactive section showing the three selfie types with descriptions.
 * Used in the selfie tips page to explain what types of selfies are needed.
 */
export default function SelfieTypeSection({ className = '' }: SelfieTypeSectionProps) {
  const t = useTranslations('selfie.types')

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900">
          {t('title', { defaultValue: 'Best Results Come From Variety' })}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {t('description', {
            defaultValue: 'Upload selfies from different angles for the most realistic headshots',
          })}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SELFIE_TYPE_REQUIREMENTS.map((req) => (
          <SelfieTypeCard key={req.type} requirement={req} />
        ))}
      </div>
    </div>
  )
}

interface SelfieTypeCardProps {
  requirement: SelfieTypeRequirement
}

function SelfieTypeCard({ requirement }: SelfieTypeCardProps) {
  const t = useTranslations('selfie.types')

  const icons: Record<SelfieType, React.ReactNode> = {
    front_view: <User className="w-8 h-8" />,
    side_view: <UserCircle className="w-8 h-8" />,
    partial_body: <User className="w-8 h-8" />,
    full_body: <Users className="w-8 h-8" />,
    unknown: <User className="w-8 h-8" />,
  }

  const colors: Record<SelfieType, { bg: string; border: string; icon: string }> = {
    front_view: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
    },
    side_view: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
    },
    partial_body: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: 'text-orange-600',
    },
    full_body: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'text-purple-600',
    },
    unknown: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: 'text-gray-600',
    },
  }

  const color = colors[requirement.type]

  // Get localized label and description, with fallback to defaults
  const labelKey = requirement.type.replace('_', '') as 'frontview' | 'sideview' | 'fullbody'
  const label = t(`${requirement.type.replace('_', '')}.label`, {
    defaultValue: requirement.label,
  })
  const description = t(`${requirement.type.replace('_', '')}.description`, {
    defaultValue: requirement.description,
  })

  return (
    <div
      className={`rounded-xl border ${color.border} ${color.bg} p-4 text-center transition-all hover:shadow-md`}
    >
      {/* Icon */}
      <div
        className={`mx-auto mb-3 w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm ${color.icon}`}
      >
        {icons[requirement.type]}
      </div>

      {/* Content */}
      <h4 className="font-semibold text-gray-900 mb-1">{label}</h4>
      <p className="text-xs text-gray-600">{description}</p>

      {/* Recommended badge */}
      {requirement.recommended && (
        <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-semibold bg-brand-primary/10 text-brand-primary rounded-full">
          {t('recommended', { defaultValue: 'Recommended' })}
        </span>
      )}
    </div>
  )
}
