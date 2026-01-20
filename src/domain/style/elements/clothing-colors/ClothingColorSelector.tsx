'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'
import { predefined, hasValue, userChoice, isUserChoice } from '../base/element-types'
import { getColorHex, type ClothingColorKey, type ColorValue, type ClothingColorValue } from './types'
import ColorWheelPicker from '@/components/ui/ColorWheelPicker'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface CustomClothingColors {
  topLayer?: string
  baseLayer?: string
  bottom?: string
  shoes?: string
}

interface ClothingColorSelectorProps {
  value: ClothingColorSettings
  onChange: (settings: ClothingColorSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
  showPredefinedBadge?: boolean // If true, show the badge even when editable
  excludeColors?: ClothingColorKey[] // Colors to hide based on shot type and clothing style
  customClothingColors?: CustomClothingColors // Colors detected from uploaded outfit image
  useCustomColors?: boolean // Whether to use colors from uploaded outfit
  onUseCustomColorsChange?: (useCustom: boolean) => void // Callback when checkbox changes
  defaultDisplayColors?: ClothingColorValue // Fallback colors to show when no colors are set
}

export default function ClothingColorSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  showPredefinedBadge = false,
  excludeColors = [],
  customClothingColors,
  useCustomColors,
  onUseCustomColorsChange,
  defaultDisplayColors
}: ClothingColorSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothingColors')

  // Check if custom clothing colors are available
  const hasCustomColors = !!(customClothingColors && (
    customClothingColors.topLayer ||
    customClothingColors.baseLayer ||
    customClothingColors.bottom ||
    customClothingColors.shoes
  ))

  // Internal state for checkbox if not controlled externally
  const [internalUseCustom, setInternalUseCustom] = React.useState(hasCustomColors)
  const isUsingCustomColors = useCustomColors ?? internalUseCustom

  // Helper to preserve mode when updating value
  // CRITICAL: Preserves predefined mode when admin is editing a predefined setting
  const wrapWithCurrentMode = (newValue: ClothingColorValue): ClothingColorSettings => {
    return value.mode === 'predefined' ? predefined(newValue) : userChoice(newValue)
  }

  const handleUseCustomColorsToggle = (checked: boolean) => {
    if (onUseCustomColorsChange) {
      onUseCustomColorsChange(checked)
    } else {
      setInternalUseCustom(checked)
    }

    // When toggling to use custom colors, apply them with source: 'outfit'
    // This tells the prompt builder to skip color specifications (let AI match reference image)
    if (checked && customClothingColors) {
      const newValue: ClothingColorValue = {
        topLayer: customClothingColors.topLayer,
        baseLayer: customClothingColors.baseLayer,
        bottom: customClothingColors.bottom,
        shoes: customClothingColors.shoes,
        source: 'outfit' // Mark as from outfit - prompt will defer to reference image
      }
      onChange(wrapWithCurrentMode(newValue))
    } else if (!checked) {
      // When unchecking, clear source so manual colors are used in prompt
      const currentColors = hasValue(value) ? value.value : {}
      const newValue: ClothingColorValue = {
        ...currentColors,
        source: 'manual' // Mark as manual - colors will be specified in prompt
      }
      onChange(wrapWithCurrentMode(newValue))
    }
  }

  const isExcluded = (colorKey: ClothingColorKey) => excludeColors.includes(colorKey)

  // Multi-layer garments show both topLayer and baseLayer
  // Single-layer garments only show topLayer (baseLayer is excluded)
  const isMultiLayer = !isExcluded('baseLayer')

  // Extract the color value from the wrapper
  const colorValue = hasValue(value) ? value.value : undefined

  // Check if colorValue has any actual colors set
  const hasActualColors = colorValue && Object.keys(colorValue).some(
    key => key !== 'source' && colorValue[key as keyof typeof colorValue]
  )

  // When using custom colors, show those instead
  // Otherwise, prioritize defaultDisplayColors (validated colors) to match clothes preview
  const displayColors = isUsingCustomColors && customClothingColors
    ? customClothingColors
    : defaultDisplayColors || (hasActualColors ? colorValue : undefined)
  
  // Helper to get full ColorValue for ColorWheelPicker (preserves both hex and name)
  const getColorValue = (color: string | ColorValue | undefined): ColorValue | string => {
    if (!color) return ''
    // If already a ColorValue object, return as-is to preserve name
    if (typeof color === 'object') return color
    // If just a hex string, return as-is (ColorWheelPicker handles both)
    return color
  }

  const handleColorChange = (colorType: ClothingColorKey, color: ColorValue) => {
    if (isPredefined || (isUsingCustomColors && hasCustomColors)) return

    const newValue: ClothingColorValue = {
      ...colorValue,
      [colorType]: color
    }
    // Preserve the existing mode using helper
    onChange(wrapWithCurrentMode(newValue))
  }

  const visibleCount = 4 - excludeColors.length

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Clothing Colors' })}
            </h3>
            <p className="hidden md:block text-sm text-gray-600">
              {t('subtitle', { default: 'Choose colors for clothing items' })}
            </p>
          </div>
          {(isPredefined || showPredefinedBadge) && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {t('predefined', { default: 'Predefined' })}
            </span>
          )}
        </div>
      )}

      {/* Checkbox to use colors from uploaded outfit */}
      {hasCustomColors && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isUsingCustomColors}
              onChange={(e) => handleUseCustomColorsToggle(e.target.checked)}
              disabled={isDisabled}
              className="mt-0.5 h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <PhotoIcon className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">
                  {t('useOutfitColors', { default: 'Use colors from uploaded outfit' })}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {isUsingCustomColors
                  ? t('outfitColorsActive', { default: 'Colors are synced with your uploaded outfit image' })
                  : t('outfitColorsInactive', { default: 'Uncheck to customize colors manually' })
                }
              </p>
            </div>
          </label>
        </div>
      )}

      {visibleCount === 0 ? (
        <p className="text-sm text-gray-500 italic">
          {t('noVisibleColors', { default: 'No clothing colors applicable for this shot type and style.' })}
        </p>
      ) : (
        <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''} ${isUsingCustomColors && hasCustomColors ? 'opacity-75' : ''}`}>
          {/* Top Layer - always shown (the visible outer garment) */}
          {!isExcluded('topLayer') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="outer garment">🧥</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('topLayer', { default: 'Top layer' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('topLayerDesc', { default: 'The visible outer garment: jacket, blazer, hoodie, polo, t-shirt, dress' })}
                  </p>
                </div>
              </div>
              <ColorWheelPicker
                value={getColorValue(displayColors?.topLayer)}
                onChange={(color) => handleColorChange('topLayer', color)}
                disabled={isPredefined || isDisabled || (isUsingCustomColors && hasCustomColors)}
              />
            </div>
          )}

          {/* Base Layer - only shown for multi-layer garments */}
          {!isExcluded('baseLayer') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="shirt">👔</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('baseLayer', { default: 'Base layer' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('baseLayerDesc', { default: 'Shirt or t-shirt underneath the top layer' })}
                  </p>
                </div>
              </div>
              <ColorWheelPicker
                value={getColorValue(displayColors?.baseLayer)}
                onChange={(color) => handleColorChange('baseLayer', color)}
                disabled={isPredefined || isDisabled || (isUsingCustomColors && hasCustomColors)}
              />
            </div>
          )}

          {/* Pants/Skirt */}
          {!isExcluded('bottom') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="pants">👖</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('pantsSkirt', { default: 'Pants/Skirt' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('pantsSkirtDesc', { default: 'Trousers, slacks, skirt' })}
                  </p>
                </div>
              </div>
              <ColorWheelPicker
                value={getColorValue(displayColors?.bottom)}
                onChange={(color) => handleColorChange('bottom', color)}
                disabled={isPredefined || isDisabled || (isUsingCustomColors && hasCustomColors)}
              />
            </div>
          )}

          {/* Shoes */}
          {!isExcluded('shoes') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="shoes">👞</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('shoes', { default: 'Shoes' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('shoesDesc', { default: 'Dress shoes, casual shoes' })}
                  </p>
                </div>
              </div>
              <ColorWheelPicker
                value={getColorValue(displayColors?.shoes)}
                onChange={(color) => handleColorChange('shoes', color)}
                disabled={isPredefined || isDisabled || (isUsingCustomColors && hasCustomColors)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

