'use client'

import { useTranslations } from 'next-intl'
import { ShotTypeSettings, ShotTypeValue } from '@/types/photo-style'
import { resolveShotType, type CanonicalShotType, SHOT_TYPE_CONFIGS } from './config'
import { hasValue, predefined, isUserChoice, userChoice } from '../base/element-types'

interface ShotTypeSelectorProps {
  value: ShotTypeSettings
  onChange: (settings: ShotTypeSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
}

const CANONICAL_SHOT_TYPES: CanonicalShotType[] = [
  'medium-close-up',
  'medium-shot',
  'three-quarter',
  'full-length'
]

const SHOT_TYPES = CANONICAL_SHOT_TYPES.map((type, idx) => {
  const config = SHOT_TYPE_CONFIGS[type]
  const colorMap = [
    { icon: '👤', color: 'from-blue-500 to-cyan-500' },      // medium-close-up
    { icon: '🧍', color: 'from-purple-500 to-pink-500' },    // medium-shot
    { icon: '🚶', color: 'from-orange-500 to-red-500' },     // three-quarter
    { icon: '🧘', color: 'from-green-500 to-emerald-500' }   // full-length
  ]
  return {
    value: config.id,
    description: config.framingDescription,
    icon: colorMap[idx]?.icon || '📷',
    color: colorMap[idx]?.color || 'from-gray-500 to-gray-600'
  }
})

export default function ShotTypeSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false
}: ShotTypeSelectorProps) {
  const t = useTranslations('customization.photoStyle.shotType')

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = (newValue: { type: ShotTypeValue }): ShotTypeSettings => {
    return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }

  const handleShotTypeChange = (shotType: ShotTypeValue, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (isPredefined) return

    onChange(wrapWithCurrentMode({ type: shotType }))
  }

  const selectedType =
    hasValue(value) && !isUserChoice(value) ? resolveShotType(value.value.type).id : undefined

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Shot Type' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose the framing for your photo' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      {/* Shot Type Selection */}
      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {SHOT_TYPES.map((shotType) => {
          const isSelected = shotType.value === selectedType
          // On mobile, hide unselected options when predefined
          const shouldHide = isPredefined && !isSelected
          
          return (
            <button
              type="button"
              key={shotType.value}
              onClick={(e) =>
                !(isPredefined || isDisabled) &&
                handleShotTypeChange(shotType.value, e)
              }
              disabled={isPredefined || isDisabled}
              className={`w-full bg-gray-50 rounded-lg p-4 border-2 transition-all ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-sm'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                shouldHide ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl ${
                  isSelected 
                    ? `bg-gradient-to-br ${shotType.color}` 
                    : 'bg-gray-200'
                }`}>
                  {shotType.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-gray-900'}`}>
                    {t(`types.${shotType.value}.label`)}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {t(`types.${shotType.value}.description`)}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

