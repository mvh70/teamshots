'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import type { ClothingColorSettings, ColorValue, ClothingColorKey } from './types'
import { getColorHex } from './types'
import { hasValue, isUserChoice } from '../base/element-types'
import { normalizeColorToHex, hexToColorName } from '@/lib/color-utils'

/**
 * Extended props for ClothingColorsSummary that includes exclusion context
 */
export interface ClothingColorsSummaryProps extends ElementSummaryProps<ClothingColorSettings> {
  /** Colors to exclude from display based on shot type and clothing style */
  excludeColors?: ClothingColorKey[]
}

/**
 * Get the display hex for a color value.
 * Handles both hex strings and color name strings (e.g., "Dark red").
 */
function getDisplayHex(color: string | ColorValue | undefined): string | undefined {
  const rawValue = getColorHex(color)
  if (!rawValue) return undefined
  // If already a hex, return as-is; otherwise convert color name to hex
  if (rawValue.startsWith('#')) return rawValue
  return normalizeColorToHex(rawValue)
}

/**
 * Get the semantic color name for display.
 * Returns the original color name if stored as a name, otherwise derives from hex.
 */
function getSemanticColorName(color: string | ColorValue | undefined): string {
  const rawValue = getColorHex(color)
  if (!rawValue) return 'Unknown'
  
  // If it's a color name (not hex), capitalize and return it
  if (!rawValue.startsWith('#')) {
    // Capitalize first letter of each word
    return rawValue
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
  
  // If it's a hex, derive the semantic name
  return hexToColorName(rawValue)
}

export function ClothingColorsSummary({ settings, excludeColors = [] }: ClothingColorsSummaryProps) {
  // Check mode first: if user-choice, show "User choice" regardless of any stored values
  if (!settings || isUserChoice(settings)) {
    return (
      <div id="style-clothing-colors" className="flex flex-col space-y-2">
        <div className="flex items-center gap-2">
          <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Colors</span>
        </div>
        <div className="ml-6 text-sm text-gray-600 inline-flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
          <span>User choice</span>
        </div>
      </div>
    )
  }

  const colors = hasValue(settings) ? settings.value : undefined
  
  // Helper to check if a color should be shown (not excluded and has a value)
  const shouldShow = (key: ClothingColorKey, value: unknown): boolean => {
    if (excludeColors.includes(key)) return false
    return !!value
  }

  const hasAnyVisibleColor = colors && (
    shouldShow('topLayer', colors.topLayer) || 
    shouldShow('baseLayer', colors.baseLayer) || 
    shouldShow('bottom', colors.bottom) || 
    shouldShow('shoes', colors.shoes)
  )

  return (
    <div id="style-clothing-colors" className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Colors</span>
      </div>
      {hasAnyVisibleColor ? (
        <div className="ml-6 flex flex-wrap items-start gap-4">
          {shouldShow('topLayer', colors.topLayer) && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Top</span>
              <div 
                className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200" 
                style={{ backgroundColor: getDisplayHex(colors.topLayer) }}
              />
              <span className="text-xs text-gray-500 max-w-[60px] text-center leading-tight">
                {getSemanticColorName(colors.topLayer)}
              </span>
            </div>
          )}
          {shouldShow('baseLayer', colors.baseLayer) && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Base</span>
              <div 
                className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200" 
                style={{ backgroundColor: getDisplayHex(colors.baseLayer) }}
              />
              <span className="text-xs text-gray-500 max-w-[60px] text-center leading-tight">
                {getSemanticColorName(colors.baseLayer)}
              </span>
            </div>
          )}
          {shouldShow('bottom', colors.bottom) && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Bottom</span>
              <div 
                className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200" 
                style={{ backgroundColor: getDisplayHex(colors.bottom) }}
              />
              <span className="text-xs text-gray-500 max-w-[60px] text-center leading-tight">
                {getSemanticColorName(colors.bottom)}
              </span>
            </div>
          )}
          {shouldShow('shoes', colors.shoes) && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Shoes</span>
              <div 
                className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow ring-2 ring-transparent hover:ring-gray-200" 
                style={{ backgroundColor: getDisplayHex(colors.shoes) }}
              />
              <span className="text-xs text-gray-500 max-w-[60px] text-center leading-tight">
                {getSemanticColorName(colors.shoes)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="ml-6 text-sm text-gray-600 inline-flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
          <span>No colors defined</span>
        </div>
      )}
    </div>
  )
}
