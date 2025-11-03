'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
interface ClothingColors {
  topCover?: string
  topBase?: string
  bottom?: string
  shoes?: string
}

interface UserStyleSettings {
  clothing?: {
    style?: string
    details?: string
    accessories?: string[]
    colors?: ClothingColors
  }
  expression?: {
    type?: string
  }
  lighting?: {
    type?: string
  }
  shotType?: {
    type?: string
  }
  clothingColors?: {
    colors?: ClothingColors
  }
}

interface UserStyleSummaryProps {
  settings?: UserStyleSettings | null
}

export default function UserStyleSummary({ settings }: UserStyleSummaryProps) {
  const clothingStyle = settings?.clothing?.style
  const clothingDetails = settings?.clothing?.details
  const clothingAccessories = settings?.clothing?.accessories
  const clothingColors = settings?.clothing?.colors || settings?.clothingColors?.colors
  const expressionType = settings?.expression?.type
  const lightingType = settings?.lighting?.type

  const isHexColor = (value?: string): boolean => {
    if (!value) return false
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  }

  const getClothingPhrase = (style?: string, details?: string): string | undefined => {
    if (!style && !details) return undefined
    const norm = (s: string | undefined) => (s || '').trim().toLowerCase()
    const s = norm(style)
    let d = norm(details)

    // Normalize common detail variants
    if (d === 'buttondown' || d === 'button-down' || d === 'button down shirt') d = 'button down'
    if (d === 'tshirt' || d === 't-shirt') d = 't-shirt'
    if (d === 'suit jacket') d = 'suit'

    const styleLabel = s === 'black-tie' ? 'Black tie' : s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
    const detailLabel = d ? d.charAt(0).toUpperCase() + d.slice(1) : ''

    if (!styleLabel) return detailLabel || undefined
    if (!detailLabel) return styleLabel
    return `${styleLabel} — ${detailLabel}`
  }

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-gray-800 mb-2">User Style</h4>
      {(clothingStyle || clothingDetails) && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="underline">Clothing style</span>
          </div>
          <div className="ml-6 text-xs text-gray-500 capitalize">
            {clothingStyle === 'user-choice' ? (
              <span className="inline-flex items-center gap-1 normal-case">
                <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                User choice
              </span>
            ) : (
              getClothingPhrase(clothingStyle, clothingDetails) || ''
            )}
          </div>
          {clothingAccessories && clothingAccessories.length > 0 && (
            <div className="ml-6 text-xs text-gray-500">Accessories: {clothingAccessories.join(', ')}</div>
          )}
        </div>
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="underline">Colors</span>
        </div>
        {(clothingColors && (clothingColors.topCover || clothingColors.topBase || clothingColors.bottom || ("shoes" in clothingColors && clothingColors.shoes))) ? (
          <div className="ml-6 text-xs text-gray-500 space-y-1">
            {clothingColors.topCover && (
              <div className="flex items-center gap-2">
                <span>Cover</span>
                {isHexColor(clothingColors.topCover) ? (
                  <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.topCover }} />
                ) : (
                  <span className="text-gray-400">{clothingColors.topCover}</span>
                )}
              </div>
            )}
            {clothingColors.topBase && (
              <div className="flex items-center gap-2">
                <span>Base</span>
                {isHexColor(clothingColors.topBase) ? (
                  <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.topBase }} />
                ) : (
                  <span className="text-gray-400">{clothingColors.topBase}</span>
                )}
              </div>
            )}
            {clothingColors.bottom && (
              <div className="flex items-center gap-2">
                <span>Bottom</span>
                {isHexColor(clothingColors.bottom) ? (
                  <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.bottom }} />
                ) : (
                  <span className="text-gray-400">{clothingColors.bottom}</span>
                )}
              </div>
            )}
            {("shoes" in (clothingColors as Record<string, unknown>)) && clothingColors.shoes && (
              <div className="flex items-center gap-2">
                <span>Shoes</span>
                {isHexColor(clothingColors.shoes) ? (
                  <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.shoes }} />
                ) : (
                  <span className="text-gray-400">{clothingColors.shoes}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="ml-6 text-xs text-gray-500 inline-flex items-center gap-1">
            <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
            <span>User choice</span>
          </div>
        )}
      </div>
      {expressionType && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="underline">Expression</span>
          </div>
          <div className="ml-6 text-xs text-gray-500 capitalize">
            {expressionType === 'user-choice' ? (
              <span className="inline-flex items-center gap-1 normal-case">
                <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                User choice
              </span>
            ) : (
              expressionType
            )}
          </div>
        </div>
      )}
      {lightingType && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="underline">Lighting</span>
          </div>
          <div className="ml-6 text-xs text-gray-500 capitalize">{lightingType}</div>
        </div>
      )}
      {/* Shot type is displayed on the Composition card */}
    </div>
  )
}


