'use client'

import { useTranslations } from 'next-intl'
import { CameraIcon } from '@heroicons/react/24/outline'
import { ShotTypeSettings } from '@/types/photo-style'

interface ShotTypeSelectorProps {
  value: ShotTypeSettings
  onChange: (settings: ShotTypeSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
}

const SHOT_TYPES = [
  { value: 'headshot', label: 'Headshot' },
  { value: 'midchest', label: 'Mid-Chest Shot' },
  { value: 'full-body', label: 'Full Body' }
] as const

export default function ShotTypeSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = ''
}: ShotTypeSelectorProps) {
  const t = useTranslations('customization.photoStyle.shotType')

  const handleShotTypeChange = (shotType: ShotTypeSettings['type'], event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    if (isPredefined) return
    
    onChange({ type: shotType })
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('title', { default: 'Shot Type' })}
          </h3>
          <p className="text-sm text-gray-600">
            {t('subtitle', { default: 'Choose the framing for your photo' })}
          </p>
        </div>
        {isPredefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {t('predefined', { default: 'Predefined' })}
          </span>
        )}
      </div>

      {/* Shot Type Selection */}
      <div className={`space-y-3 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {SHOT_TYPES.map((shotType) => {
          const isSelected = value.type === shotType.value
          
          return (
            <button
              type="button"
              key={shotType.value}
              onClick={(e) => !(isPredefined || isDisabled) && handleShotTypeChange(shotType.value as ShotTypeSettings['type'], e)}
              disabled={isPredefined || isDisabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              } ${(isPredefined || isDisabled) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <CameraIcon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{shotType.label}</span>
              {isSelected && (
                <div className="ml-auto w-2 h-2 bg-brand-primary rounded-full"></div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

