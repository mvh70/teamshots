'use client'

import { useTranslations } from 'next-intl'
import { ClothingSettings, ClothingColorSettings, ClothingType, ClothingValue } from '@/types/photo-style'
import { predefined, hasValue, userChoice } from '../base/element-types'
import { Grid } from '@/components/ui'
import { CLOTHING_STYLES, CLOTHING_DETAILS, getAccessoriesForClothing } from './config'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import ClothingColorPreview from '../clothing-colors/ClothingColorPreview'
import type { ClothingColorKey } from '../clothing-colors/types'

interface ClothingSelectorProps {
  value: ClothingSettings
  onChange: (settings: ClothingSettings) => void
  clothingColors?: ClothingColorSettings // Colors from ClothingColorSelector
  excludeColors?: ClothingColorKey[] // Which colors to exclude from preview
  availableStyles?: string[] // Optional list of available clothing styles (filters CLOTHING_STYLES)
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  suppressAutoSelect?: boolean // If true, don't auto-select first style on mount (for progressive activation)
  className?: string
  showHeader?: boolean
}

export default function ClothingSelector({
  value,
  onChange,
  clothingColors,
  excludeColors = [],
  availableStyles,
  isPredefined = false,
  isDisabled = false,
  suppressAutoSelect = false,
  className = '',
  showHeader = false
}: ClothingSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothing')
  const [failedPreviewKey, setFailedPreviewKey] = useState<string | null>(null)

  // Filter clothing styles based on availableStyles prop
  const filteredClothingStyles = availableStyles
    ? CLOTHING_STYLES.filter(style => availableStyles.includes(style.value))
    : CLOTHING_STYLES

  // Extract the clothing value from the wrapper
  const clothingValue = hasValue(value) ? value.value : undefined
  const fallbackStyle = filteredClothingStyles[0]?.value as ClothingType | undefined
  const displayStyle = clothingValue?.style || fallbackStyle
  const fallbackDetails = displayStyle ? CLOTHING_DETAILS[displayStyle]?.[0] : undefined
  const displayDetails = clothingValue?.details || fallbackDetails
  const displayClothingValue = displayStyle
    ? {
        style: displayStyle,
        details: displayDetails,
        accessories: clothingValue?.accessories || []
      }
    : undefined
  const previewKey = displayClothingValue?.style && displayClothingValue?.details
    ? `${displayClothingValue.style}-${displayClothingValue.details}`
    : null
  const imageExists = previewKey ? failedPreviewKey !== previewKey : false

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = useCallback((newValue: ClothingValue): ClothingSettings => {
    return value?.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }, [value?.mode])

  // Initialize with first available style and detail if not set
  // This ensures the dropdown value matches what's visually displayed and shows the preview
  useEffect(() => {
    if (!clothingValue?.style && filteredClothingStyles.length > 0 && !isPredefined && !isDisabled && !suppressAutoSelect) {
      const defaultStyle = filteredClothingStyles[0].value as ClothingType
      const defaultDetails = CLOTHING_DETAILS[defaultStyle]?.[0]
      const newValue: ClothingValue = {
        style: defaultStyle,
        details: defaultDetails,
        accessories: []
      }
      onChange(wrapWithCurrentMode(newValue))
    }
  }, [clothingValue?.style, filteredClothingStyles, isPredefined, isDisabled, suppressAutoSelect, onChange, wrapWithCurrentMode])

  const handleStyleChange = (style: ClothingType, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    // Set the first available detail for the new style so preview shows immediately
    const defaultDetails = CLOTHING_DETAILS[style]?.[0]
    const newValue: ClothingValue = {
      style,
      details: defaultDetails,
      accessories: []
    }

    onChange(wrapWithCurrentMode(newValue))
  }

  const handleDetailChange = (detail: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (!displayClothingValue?.style) return
    onChange(wrapWithCurrentMode({
      ...displayClothingValue,
      details: detail,
      accessories: displayClothingValue.accessories || []
    }))
  }

  const handleAccessoryToggle = (accessory: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined || !displayClothingValue?.style) return

    const currentAccessories = displayClothingValue.accessories || []
    const newAccessories = currentAccessories.includes(accessory)
      ? currentAccessories.filter((a: string) => a !== accessory)
      : [...currentAccessories, accessory]

    onChange(wrapWithCurrentMode({ ...displayClothingValue, accessories: newAccessories }))
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

      {/* Clothing Style Selection - Dropdown */}
      <div className="mb-6">
        <select
          value={displayStyle || ''}
          onChange={(e) => !(isPredefined || isDisabled) && handleStyleChange(e.target.value as ClothingType)}
          disabled={isPredefined || isDisabled}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary ${
            (isPredefined || isDisabled) ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'
          }`}
        >
          {filteredClothingStyles.map((style) => (
            <option key={style.value} value={style.value}>
              {style.icon} {t(`styles.${style.value}.label`)}
            </option>
          ))}
        </select>
      </div>

      {/* Style-specific controls */}
      {displayClothingValue?.style && (
        <div className={`space-y-6 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Details Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('details.label', { default: 'Details' })}
            </label>
            <Grid cols={{ mobile: 2 }} gap="sm">
              {CLOTHING_DETAILS[displayClothingValue.style]?.map((detail) => {
                const isSelected = displayClothingValue.details === detail
                return (
                  <button
                    type="button"
                    key={detail}
                    onClick={(e) => handleDetailChange(detail, e)}
                    className={`p-2 text-sm rounded border transition-colors ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    {t(`details_options.${detail}`)}
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
                  {getAccessoriesForClothing(displayClothingValue.style, displayClothingValue.details).map((accessory) => {
                    const isSelected = displayClothingValue.accessories?.includes(accessory) || false
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

          {/* Preview Image with Colors */}
          {displayClothingValue.details && imageExists && displayClothingValue.style && (
            <div className="mt-6">
              {clothingColors && hasValue(clothingColors) ? (
                <ClothingColorPreview
                  colors={clothingColors.value}
                  clothingStyle={displayClothingValue.style}
                  clothingDetail={displayClothingValue.details}
                  excludeColors={excludeColors}
                />
              ) : (
                <Image
                  src={`/images/clothing/${displayClothingValue.style}-${displayClothingValue.details}.png`}
                  alt={`${t(`styles.${displayClothingValue.style}.label`)} - ${t(`details_options.${displayClothingValue.details}`)}`}
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                  onError={() => {
                    if (previewKey) setFailedPreviewKey(previewKey)
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
