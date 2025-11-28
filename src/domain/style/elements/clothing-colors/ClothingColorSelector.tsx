'use client'

import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'
import type { ClothingColorKey } from './types'
import ColorPicker from '@/components/ui/ColorPicker'

// Common clothing color presets
const CLOTHING_COLOR_PRESETS = [
  '#000000', // Black
  '#1f2937', // Charcoal
  '#374151', // Dark gray
  '#6b7280', // Gray
  '#9ca3af', // Light gray
  '#ffffff', // White
  '#f5f5dc', // Beige
  '#d2b48c', // Tan
  '#8b4513', // Brown
  '#4a3728', // Dark brown
  '#000080', // Navy
  '#1e3a5f', // Dark blue
  '#3b82f6', // Blue
  '#60a5fa', // Light blue
  '#14532d', // Dark green
  '#166534', // Forest green
  '#800020', // Burgundy
  '#7f1d1d', // Dark red
  '#78350f', // Olive
  '#fef3c7', // Cream
]

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

  const handleColorChange = (colorType: ClothingColorKey, color: string) => {
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
          {/* Outer Layer */}
          {!isExcluded('topCover') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="jacket">🧥</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('outerLayer', { default: 'Outer Layer' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('outerLayerDesc', { default: 'Blazer, jacket, cardigan' })}
                  </p>
                </div>
              </div>
              <ColorPicker
                value={value.colors?.topCover ?? ''}
                onChange={(color) => handleColorChange('topCover', color)}
                presets={CLOTHING_COLOR_PRESETS}
                disabled={isPredefined || isDisabled}
              />
            </div>
          )}

          {/* Shirt/Blouse */}
          {!isExcluded('topBase') && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" role="img" aria-label="shirt">👔</span>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    {t('shirtBlouse', { default: 'Shirt/Blouse' })}
                  </label>
                  <p className="text-xs text-gray-500">
                    {t('shirtBlouseDesc', { default: 'Dress shirt, blouse, polo' })}
                  </p>
                </div>
              </div>
              <ColorPicker
                value={value.colors?.topBase ?? ''}
                onChange={(color) => handleColorChange('topBase', color)}
                presets={CLOTHING_COLOR_PRESETS}
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
              <ColorPicker
                value={value.colors?.bottom ?? ''}
                onChange={(color) => handleColorChange('bottom', color)}
                presets={CLOTHING_COLOR_PRESETS}
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
              <ColorPicker
                value={value.colors?.shoes ?? ''}
                onChange={(color) => handleColorChange('shoes', color)}
                presets={CLOTHING_COLOR_PRESETS}
                disabled={isPredefined || isDisabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

