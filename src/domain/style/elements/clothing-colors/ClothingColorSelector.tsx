'use client'

import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'
import type { ClothingColorKey, ColorValue } from './types'
import ColorWheelPicker from '@/components/ui/ColorWheelPicker'

interface ClothingColorSelectorProps {
  value: ClothingColorSettings
  onChange: (settings: ClothingColorSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
  showPredefinedBadge?: boolean // If true, show the badge even when editable
  excludeColors?: ClothingColorKey[] // Colors to hide based on shot type and clothing style
}

export default function ClothingColorSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  showPredefinedBadge = false,
  excludeColors = []
}: ClothingColorSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothingColors')

  const isExcluded = (colorKey: ClothingColorKey) => excludeColors.includes(colorKey)

  // Multi-layer garments show both topLayer and baseLayer
  // Single-layer garments only show topLayer (baseLayer is excluded)
  const isMultiLayer = !isExcluded('baseLayer')

  const handleColorChange = (colorType: ClothingColorKey, color: ColorValue) => {
    if (isPredefined) return

    onChange({
      // Preserve the existing type (user-choice or predefined)
      type: value.type || 'user-choice',
      colors: {
        ...value.colors,
        [colorType]: color
      }
    })
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

      {visibleCount === 0 ? (
        <p className="text-sm text-gray-500 italic">
          {t('noVisibleColors', { default: 'No clothing colors applicable for this shot type and style.' })}
        </p>
      ) : (
        <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
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
                value={value.colors?.topLayer ?? ''}
                onChange={(color) => handleColorChange('topLayer', color)}
                disabled={isPredefined || isDisabled}
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
                value={value.colors?.baseLayer ?? ''}
                onChange={(color) => handleColorChange('baseLayer', color)}
                disabled={isPredefined || isDisabled}
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
                value={value.colors?.bottom ?? ''}
                onChange={(color) => handleColorChange('bottom', color)}
                disabled={isPredefined || isDisabled}
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
                value={value.colors?.shoes ?? ''}
                onChange={(color) => handleColorChange('shoes', color)}
                disabled={isPredefined || isDisabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

