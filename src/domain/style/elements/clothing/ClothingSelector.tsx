'use client'

import { useTranslations } from 'next-intl'
import { ClothingSettings } from '@/types/photo-style'
import { Grid } from '@/components/ui'
import { CLOTHING_STYLES, CLOTHING_DETAILS, CLOTHING_ACCESSORIES } from './config'

interface ClothingSelectorProps {
  value: ClothingSettings
  onChange: (settings: ClothingSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
}

export default function ClothingSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false
}: ClothingSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothing')

  const handleStyleChange = (style: ClothingSettings['style'], event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    const newSettings: ClothingSettings = { 
      style,
      details: undefined, // Reset details when style changes
      accessories: []
    }
    
    onChange(newSettings)
  }

  const handleDetailChange = (detail: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    onChange({ ...value, details: detail })
  }

  const handleAccessoryToggle = (accessory: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined) return
    
    const currentAccessories = value.accessories || []
    const newAccessories = currentAccessories.includes(accessory)
      ? currentAccessories.filter(a => a !== accessory)
      : [...currentAccessories, accessory]
    
    onChange({ ...value, accessories: newAccessories })
  }


  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Clothing Style' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose clothing style and accessories' })}
            </p>
          </div>
          {isPredefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      {/* Clothing Style Selection */}
      <div className="space-y-4 mb-6">
        {CLOTHING_STYLES.map((style) => {
          const isSelected = value.style === style.value
          // On mobile, hide unselected options when predefined
          const shouldHide = isPredefined && !isSelected
          
          return (
            <button
              type="button"
              key={style.value}
              onClick={(e) => !(isPredefined || isDisabled) && handleStyleChange(style.value as ClothingSettings['style'], e)}
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
                    ? `bg-gradient-to-br ${style.color}` 
                    : 'bg-gray-200'
                }`}>
                  {style.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-gray-900'}`}>
                    {style.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {style.description}
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

      {/* Style-specific controls */}
      {value.style && value.style !== 'user-choice' && (
        <div className={`space-y-6 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Details Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('details.label', { default: 'Details' })}
            </label>
            <Grid cols={{ mobile: 2 }} gap="sm">
              {CLOTHING_DETAILS[value.style]?.map((detail) => {
                const isSelected = value.details === detail.value
                return (
                  <button
                    type="button"
                    key={detail.value}
                    onClick={(e) => handleDetailChange(detail.value, e)}
                    className={`p-2 text-sm rounded border transition-colors ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    {detail.label}
                  </button>
                )
              })}
            </Grid>
          </div>

          {/* Accessories Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                {t('accessories.label', { default: 'Accessories' })}
              </label>
            </div>
            
            {/* Accessory Selector */}
            {!(isPredefined || isDisabled) && (
              <Grid cols={{ mobile: 2 }} gap="sm" className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                {CLOTHING_ACCESSORIES[value.style]?.map((accessory) => {
                  const isSelected = value.accessories?.includes(accessory) || false
                  return (
                    <button
                      type="button"
                      key={accessory}
                      onClick={(e) => handleAccessoryToggle(accessory, e)}
                      className={`p-2 text-xs rounded border transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                      )}
                      {accessory}
                    </button>
                  )
                })}
              </Grid>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

