'use client'

import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import { UserIcon } from '@heroicons/react/24/outline'
import { resolveExpression } from '@/domain/style/packages/expression-config'
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
  const hasClothing = settings?.clothing !== undefined
  const hasExpression = settings?.expression !== undefined
  const hasLighting = settings?.lighting !== undefined

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
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-6 border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-gradient-to-br from-brand-secondary/5 to-brand-primary/5 rounded-full blur-xl" />
      
      <div className="relative space-y-4">
        {/* Header with icon */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-secondary to-brand-secondary-hover flex items-center justify-center shadow-sm">
            <UserIcon className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <h4 className="text-lg font-bold text-gray-900">User Style</h4>
        </div>
        
        {/* Content */}
        <div className="pt-1 space-y-3">
          {hasClothing && (
            <div id="style-clothing-type" className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline font-medium text-gray-700">Clothing style</span>
              </div>
              <div className="ml-6 text-xs text-gray-500 capitalize">
                {!clothingStyle || clothingStyle === 'user-choice' ? (
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
          <div id="style-clothing-colors" className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline font-medium text-gray-700">Colors</span>
            </div>
            {(clothingColors && (clothingColors.topCover || clothingColors.topBase || clothingColors.bottom || ("shoes" in clothingColors && clothingColors.shoes))) ? (
                             <div className="ml-6 text-xs text-gray-500 space-y-2">
                 {clothingColors.topCover && (
                   <div className="flex items-center gap-3">
                     <span className="w-12">Cover</span>
                     {isHexColor(clothingColors.topCover) ? (
                       <div className="w-8 h-8 rounded-md border-2 border-gray-300 shadow-sm" style={{ backgroundColor: clothingColors.topCover }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.topCover}</span>
                     )}
                   </div>
                 )}
                 {clothingColors.topBase && (
                   <div className="flex items-center gap-3">
                     <span className="w-12">Base</span>
                     {isHexColor(clothingColors.topBase) ? (
                       <div className="w-8 h-8 rounded-md border-2 border-gray-300 shadow-sm" style={{ backgroundColor: clothingColors.topBase }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.topBase}</span>
                     )}
                   </div>
                 )}
                 {clothingColors.bottom && (
                   <div className="flex items-center gap-3">
                     <span className="w-12">Bottom</span>
                     {isHexColor(clothingColors.bottom) ? (
                       <div className="w-8 h-8 rounded-md border-2 border-gray-300 shadow-sm" style={{ backgroundColor: clothingColors.bottom }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.bottom}</span>
                     )}
                   </div>
                 )}
                 {("shoes" in (clothingColors as Record<string, unknown>)) && clothingColors.shoes && (
                   <div className="flex items-center gap-3">
                     <span className="w-12">Shoes</span>
                     {isHexColor(clothingColors.shoes) ? (
                       <div className="w-8 h-8 rounded-md border-2 border-gray-300 shadow-sm" style={{ backgroundColor: clothingColors.shoes }} />
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
          {hasExpression && (
            <div id="style-expression" className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline font-medium text-gray-700">Expression</span>
              </div>
              <div className="ml-6 text-xs text-gray-500 capitalize">
                {!expressionType || expressionType === 'user-choice' ? (
                  <span className="inline-flex items-center gap-1 normal-case">
                    <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                    User choice
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-700 normal-case">
                    <span className="font-medium">
                      {resolveExpression(expressionType)?.label ?? expressionType}
                    </span>
                    {resolveExpression(expressionType)?.description && (
                      <span className="relative inline-flex group">
                        <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[10px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                          {resolveExpression(expressionType)?.description}
                        </span>
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
          {hasLighting && (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline font-medium text-gray-700">Lighting</span>
              </div>
              <div className="ml-6 text-xs text-gray-500 capitalize">
                {!lightingType || lightingType === 'user-choice' ? (
                  <span className="inline-flex items-center gap-1 normal-case">
                    <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                    User choice
                  </span>
                ) : (
                  lightingType
                )}
              </div>
            </div>
          )}
          {/* Shot type is displayed on the Composition card */}
        </div>
      </div>
    </div>
  )
}


