'use client'

interface ClothingColors {
  topCover?: string
  topBase?: string
  bottom?: string
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
}

interface UserStyleSummaryProps {
  settings?: UserStyleSettings | null
}

export default function UserStyleSummary({ settings }: UserStyleSummaryProps) {
  const clothingStyle = settings?.clothing?.style
  const clothingDetails = settings?.clothing?.details
  const clothingAccessories = settings?.clothing?.accessories
  const clothingColors = settings?.clothing?.colors
  const expressionType = settings?.expression?.type
  const lightingType = settings?.lighting?.type

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-gray-800 mb-2">User Style</h4>
      {(clothingStyle || clothingDetails || (clothingAccessories && clothingAccessories.length > 0) || clothingColors) && (
        <div className="space-y-1">
          {clothingStyle && (
            <div className="flex items-center gap-2">
              <strong>Clothing:</strong>
              <span className="capitalize">{clothingStyle === 'user-choice' ? 'User choice' : clothingStyle}</span>
            </div>
          )}
          {clothingDetails && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-500">Style:</span>
              <span className="text-xs capitalize">{clothingDetails}</span>
            </div>
          )}
          {clothingAccessories && clothingAccessories.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-500">Accessories:</span>
              <span className="text-xs">{clothingAccessories.join(', ')}</span>
            </div>
          )}
          {clothingColors && (clothingColors.topCover || clothingColors.topBase || clothingColors.bottom) && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-500">Colors:</span>
              <div className="flex items-center gap-1">
                {clothingColors.topCover && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.topCover }} />
                    <span className="text-xs">Cover</span>
                  </div>
                )}
                {clothingColors.topBase && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.topBase }} />
                    <span className="text-xs">Base</span>
                  </div>
                )}
                {clothingColors.bottom && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: clothingColors.bottom }} />
                    <span className="text-xs">Bottom</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {expressionType && (
        <div className="flex items-center gap-2">
          <strong>Expression:</strong>
          <span className="capitalize">{expressionType}</span>
        </div>
      )}
      {lightingType && (
        <div className="flex items-center gap-2">
          <strong>Lighting:</strong>
          <span className="capitalize">{lightingType}</span>
        </div>
      )}
    </div>
  )
}


