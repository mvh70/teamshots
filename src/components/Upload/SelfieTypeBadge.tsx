'use client'

import { useTranslations } from 'next-intl'
import { Sun, Layers, Check, X } from 'lucide-react'
import type { SelfieType, QualityRating } from '@/domain/selfie/selfie-types'
import {
  getSelfieTypeRequirement,
  getConfidenceLevel,
} from '@/domain/selfie/selfie-types'

interface SelfieTypeBadgeProps {
  type: SelfieType
  confidence: number
  isLoading?: boolean
  className?: string
  showConfidence?: boolean
  lightingQuality?: QualityRating | null
  backgroundQuality?: QualityRating | null
}

/**
 * Visual badge showing the detected selfie type with confidence indicator.
 *
 * Color-coded:
 * - front_view: green
 * - side_view: blue
 * - full_body: purple
 * - unknown: gray
 */
export default function SelfieTypeBadge({
  type,
  confidence,
  isLoading = false,
  className = '',
  showConfidence = true,
  lightingQuality,
  backgroundQuality,
}: SelfieTypeBadgeProps) {
  const t = useTranslations('selfie')

  if (isLoading) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 ${className}`}
      >
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-600">
          {t('classification.analyzing')}
        </span>
      </div>
    )
  }

  const requirement = getSelfieTypeRequirement(type)
  // Use translation for label, with fallback to hardcoded label
  const typeKey = type.replace('_', '') // front_view -> frontview
  const label = t(`types.${typeKey}.label`, { defaultValue: requirement?.label || 'Unknown' })
  const confidenceLevel = getConfidenceLevel(confidence)

  const colors: Record<SelfieType, string> = {
    front_view: 'bg-green-100 text-green-700 border-green-200',
    side_view: 'bg-blue-100 text-blue-700 border-blue-200',
    partial_body: 'bg-orange-100 text-orange-700 border-orange-200',
    full_body: 'bg-purple-100 text-purple-700 border-purple-200',
    unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const iconColors: Record<SelfieType, string> = {
    front_view: 'text-green-500',
    side_view: 'text-blue-500',
    partial_body: 'text-orange-500',
    full_body: 'text-purple-500',
    unknown: 'text-gray-400',
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[type]} ${className}`}
    >
      <SelfieTypeIcon type={type} className={`w-4 h-4 ${iconColors[type]}`} />
      <span className="text-sm font-medium">{label}</span>
      {showConfidence && type !== 'unknown' && (
        <span className="text-xs opacity-75">
          ({t(`classification.confidence.${confidenceLevel}`)})
        </span>
      )}
    </div>
  )
}

interface SelfieTypeIconProps {
  type: SelfieType
  className?: string
}

function SelfieTypeIcon({ type, className = '' }: SelfieTypeIconProps) {
  switch (type) {
    case 'front_view':
      // Face front icon
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="8" r="5" />
          <path
            strokeLinecap="round"
            d="M9 9.5h.01M15 9.5h.01M10 12a2 2 0 104 0"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2"
          />
        </svg>
      )

    case 'side_view':
      // Profile icon
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
          <path strokeLinecap="round" d="M16 10l2-1" />
        </svg>
      )

    case 'partial_body':
      // Half body / torso icon
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="5" r="3" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v8M8 12h8M6 20h12"
          />
        </svg>
      )

    case 'full_body':
      // Full body icon
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="4" r="2" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6m0 0l-3 6m3-6l3 6M8 12h8"
          />
        </svg>
      )

    default:
      // Question mark icon for unknown
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.01 4h.01"
          />
        </svg>
      )
  }
}

export { SelfieTypeIcon }

/**
 * Separate badge for lighting or background quality assessment.
 * Shows check for good/acceptable, X for poor.
 */
interface QualityBadgeProps {
  type: 'lighting' | 'background'
  quality: QualityRating
  className?: string
}

export function QualityBadge({ type, quality, className = '' }: QualityBadgeProps) {
  const t = useTranslations('selfie')

  const isGood = quality === 'good' || quality === 'acceptable'

  const badgeColors = isGood
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200'

  const iconColor = isGood ? 'text-green-500' : 'text-red-500'

  const label = type === 'lighting'
    ? t('quality.lightingLabel', { defaultValue: 'Lighting' })
    : t('quality.backgroundLabel', { defaultValue: 'Background' })

  const Icon = type === 'lighting' ? Sun : Layers
  const StatusIcon = isGood ? Check : X

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${badgeColors} ${className}`}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <StatusIcon className={`w-3 h-3 ${iconColor}`} />
    </div>
  )
}
