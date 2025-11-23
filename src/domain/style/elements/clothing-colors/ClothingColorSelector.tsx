'use client'

import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'
import { normalizeColorToHex } from './config'

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
      // Preserve the existing type (user-choice or predefined)
      type: value.type || 'user-choice',
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

      {/* Colors Section */}
      <div className={`space-y-4 ${isDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Outer Layer */}
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
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColorToHex(value.colors?.topCover)}
              onChange={(e) => handleColorChange('topCover', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-14 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.topCover || ''}
              onChange={(e) => handleColorChange('topCover', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., navy, black"
            />
          </div>
        </div>

        {/* Shirt/Blouse */}
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
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColorToHex(value.colors?.topBase)}
              onChange={(e) => handleColorChange('topBase', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-14 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.topBase || ''}
              onChange={(e) => handleColorChange('topBase', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., white, blue"
            />
          </div>
        </div>

        {/* Pants/Skirt */}
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
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColorToHex(value.colors?.bottom)}
              onChange={(e) => handleColorChange('bottom', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-14 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.bottom || ''}
              onChange={(e) => handleColorChange('bottom', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., black, gray"
            />
          </div>
        </div>

        {/* Shoes */}
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
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColorToHex(value.colors?.shoes)}
              onChange={(e) => handleColorChange('shoes', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="h-10 w-14 p-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={value.colors?.shoes || ''}
              onChange={(e) => handleColorChange('shoes', e.target.value)}
              disabled={isPredefined || isDisabled}
              className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., black, brown"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

