'use client'

import { useTranslations } from 'next-intl'
import { ClothingSettings, ClothingColorSettings, ClothingType, ClothingValue } from '@/types/photo-style'
import { predefined, hasValue } from '../base/element-types'
import { Grid } from '@/components/ui'
import { CLOTHING_STYLES, CLOTHING_DETAILS, CLOTHING_ACCESSORIES } from './config'
import Image from 'next/image'
import { useState, useEffect } from 'react'
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
  className = '',
  showHeader = false
}: ClothingSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothing')
  const [imageExists, setImageExists] = useState(true)

  // Extract the clothing value from the wrapper
  const clothingValue = hasValue(value) ? value.value : undefined

  // Filter clothing styles based on availableStyles prop
  const filteredClothingStyles = availableStyles
    ? CLOTHING_STYLES.filter(style => availableStyles.includes(style.value))
    : CLOTHING_STYLES

  // Initialize with first available style and detail if not set
  // This ensures the dropdown value matches what's visually displayed and shows the preview
  useEffect(() => {
    if (!clothingValue?.style && filteredClothingStyles.length > 0 && !isPredefined && !isDisabled) {
      const defaultStyle = filteredClothingStyles[0].value as ClothingType
      const defaultDetails = CLOTHING_DETAILS[defaultStyle]?.[0]
      const newValue: ClothingValue = {
        style: defaultStyle,
        details: defaultDetails,
        accessories: []
      }
      onChange(predefined(newValue))
    }
  }, [clothingValue?.style, filteredClothingStyles, isPredefined, isDisabled, onChange])

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

    onChange(predefined(newValue))
  }

  const handleDetailChange = (detail: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (!clothingValue) return
    onChange(predefined({ ...clothingValue, details: detail }))
  }

  const handleAccessoryToggle = (accessory: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (isPredefined || !clothingValue) return

    const currentAccessories = clothingValue.accessories || []
    const newAccessories = currentAccessories.includes(accessory)
      ? currentAccessories.filter((a: string) => a !== accessory)
      : [...currentAccessories, accessory]

    onChange(predefined({ ...clothingValue, accessories: newAccessories }))
  }

  // Reset image exists state when style or details change
  useEffect(() => {
    setImageExists(true)
  }, [clothingValue?.style, clothingValue?.details])


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
          value={clothingValue?.style || ''}
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
      {clothingValue?.style && (
        <div className={`space-y-6 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Details Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('details.label', { default: 'Details' })}
            </label>
            <Grid cols={{ mobile: 2 }} gap="sm">
              {CLOTHING_DETAILS[clothingValue.style]?.map((detail) => {
                const isSelected = clothingValue.details === detail
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
                {CLOTHING_ACCESSORIES[clothingValue.style]?.map((accessory) => {
                  const isSelected = clothingValue.accessories?.includes(accessory) || false
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
          {clothingValue.details && imageExists && clothingValue.style && (
            <div className="mt-6 rounded-md overflow-hidden border border-gray-200 bg-white p-4">
              {clothingColors && hasValue(clothingColors) ? (
                <ClothingColorPreview
                  colors={clothingColors.value}
                  clothingStyle={clothingValue.style}
                  clothingDetail={clothingValue.details}
                  excludeColors={excludeColors}
                />
              ) : (
                <Image
                  src={`/images/clothing/${clothingValue.style}-${clothingValue.details}.png`}
                  alt={`${t(`styles.${clothingValue.style}.label`)} - ${t(`details_options.${clothingValue.details}`)}`}
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                  onError={() => setImageExists(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

