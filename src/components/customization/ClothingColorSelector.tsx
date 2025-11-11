'use client'

import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'

interface ClothingColorSelectorProps {
  value: ClothingColorSettings
  onChange: (settings: ClothingColorSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
  showPredefinedBadge?: boolean // If true, show the badge even when editable
}

export default function ClothingColorSelector({
  value,
  onChange,
  isPredefined = false,
  isDisabled = false,
  className = '',
  showHeader = false,
  showPredefinedBadge = false
}: ClothingColorSelectorProps) {
  const t = useTranslations('customization.photoStyle.clothingColors')

  const handleColorChange = (colorType: 'topCover' | 'topBase' | 'bottom' | 'shoes', color: string) => {
    if (isPredefined) return
    
    onChange({ 
      // When a user provides any color, this becomes a concrete choice
      type: 'predefined',
      colors: { 
        ...value.colors, 
        [colorType]: color 
      } 
    })
  }

  return (
    <div className={`${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('title', { default: 'Clothing Colors' })}
            </h3>
            <p className="text-sm text-gray-600">
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

      {/* Colors Section */}
      <div className={`space-y-3 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Top Cover Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Top Cover (Blazer/Jacket)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.colors?.topCover || '#000000'}
              onChange={(e) => handleColorChange('topCover', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-8 w-12 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.topCover || ''}
              onChange={(e) => handleColorChange('topCover', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., navy, black"
            />
          </div>
        </div>

        {/* Top Base Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Base Layer (Shirt/T-shirt)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.colors?.topBase || '#ffffff'}
              onChange={(e) => handleColorChange('topBase', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-8 w-12 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.topBase || ''}
              onChange={(e) => handleColorChange('topBase', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., white, blue"
            />
          </div>
        </div>

        {/* Bottom Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Bottom (Pants/Skirt)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.colors?.bottom || '#000000'}
              onChange={(e) => handleColorChange('bottom', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-8 w-12 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.bottom || ''}
              onChange={(e) => handleColorChange('bottom', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., black, gray"
            />
          </div>
        </div>

        {/* Shoes Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Shoes</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.colors?.shoes || '#000000'}
              onChange={(e) => handleColorChange('shoes', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-8 w-12 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.shoes || ''}
              onChange={(e) => handleColorChange('shoes', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., black, brown"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

