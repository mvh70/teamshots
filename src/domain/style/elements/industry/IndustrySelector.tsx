'use client'

import { useTranslations } from 'next-intl'
import type { IndustrySettings, IndustryType } from './types'
import { INDUSTRY_CONFIGS } from './config'
import { predefined, userChoice } from '../base/element-types'

interface IndustrySelectorProps {
  value: IndustrySettings
  onChange: (settings: IndustrySettings) => void
  isPredefined?: boolean
  isDisabled?: boolean
  className?: string
  showHeader?: boolean
  availableIndustries?: IndustryType[]
}

export default function IndustrySelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  availableIndustries,
}: IndustrySelectorProps) {
  const t = useTranslations('customization.photoStyle.industry')

  const industryValue = value?.value

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = (newValue: { type: IndustryType }): IndustrySettings => {
    return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }

  const visibleIndustries = availableIndustries
    ? INDUSTRY_CONFIGS.filter((i) => availableIndustries.includes(i.value))
    : INDUSTRY_CONFIGS

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPredefined || isDisabled) return
    onChange(wrapWithCurrentMode({ type: event.target.value as IndustryType }))
  }

  const selectedIndustry = visibleIndustries.find((i) => i.value === industryValue?.type)

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title')}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle')}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined')}
            </span>
          )}
        </div>
      )}

      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="relative">
          <select
            value={industryValue?.type || ''}
            onChange={handleChange}
            disabled={isPredefined || isDisabled}
            className={`block w-full rounded-lg border-2 border-gray-200 p-3 pr-10 text-base focus:border-brand-primary focus:outline-none focus:ring-brand-primary sm:text-sm ${
              isPredefined || isDisabled ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white'
            }`}
          >
            {!industryValue?.type && (
              <option value="" disabled>
                {t('selectPlaceholder')}
              </option>
            )}
            {visibleIndustries.map((industry) => (
              <option key={industry.value} value={industry.value}>
                {t(`industries.${industry.value}.label`)}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Industry Description */}
        {selectedIndustry && (
          <p className="text-sm text-gray-600 px-1">
            {t(`industries.${selectedIndustry.value}.description`)}
          </p>
        )}
      </div>
    </div>
  )
}
