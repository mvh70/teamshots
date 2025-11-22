'use client'

import { useTranslations } from 'next-intl'
import { ClothingColorSettings } from '@/types/photo-style'
import { colornames } from 'color-name-list'

interface ClothingColorSelectorProps {
  value: ClothingColorSettings
  onChange: (settings: ClothingColorSettings) => void
  isPredefined?: boolean // If true, user can't change the settings
  isDisabled?: boolean // If true, controls are visually greyed and inactive
  className?: string
  showHeader?: boolean
  showPredefinedBadge?: boolean // If true, show the badge even when editable
}

// Common color name variations used in presets that need explicit mapping
const COMMON_COLOR_MAPPINGS: Record<string, string> = {
  'dark blue': '#00008B',
  'navy': '#000080',
  'white': '#FFFFFF',
  'black': '#000000',
  'gray': '#808080',
  'grey': '#808080',
  'charcoal': '#36454F',
  'brown': '#8B4513',
  'beige': '#F5F5DC',
  'burgundy': '#800020',
  'blue': '#0000FF',
  'light blue': '#ADD8E6',
  'red': '#FF0000',
  'green': '#008000',
  'yellow': '#FFFF00',
  'orange': '#FFA500',
  'purple': '#800080',
  'pink': '#FFC0CB',
  'tan': '#D2B48C',
  'cream': '#FFFDD0',
  'khaki': '#F0E68C',
  'olive': '#808000',
  'maroon': '#800000',
  'teal': '#008080',
  'silver': '#C0C0C0'
}

// Create a lookup map for fast color name to hex conversion from the full database
const colorMap = new Map(
  colornames.map(color => [color.name.toLowerCase(), color.hex])
)

/**
 * Normalizes a color value to hex format
 * @param color - Color name (e.g., "Dark blue") or hex value (e.g., "#00008B")
 * @returns Hex color value
 */
function normalizeColorToHex(color: string | undefined): string {
  if (!color) return '#ffffff'
  
  // If it's already a hex color, return it
  if (color.startsWith('#')) return color
  
  const lowerColor = color.toLowerCase()
  
  // First check common mappings for exact matches (faster)
  const commonMapping = COMMON_COLOR_MAPPINGS[lowerColor]
  if (commonMapping) return commonMapping
  
  // Then look up in the full color database
  const hex = colorMap.get(lowerColor)
  
  return hex || '#ffffff' // fallback to white if not found
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

