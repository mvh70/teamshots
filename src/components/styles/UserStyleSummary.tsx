'use client'

import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import { UserIcon } from '@heroicons/react/24/outline'
import { resolveExpression } from '@/domain/style/elements/expression/config'
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
    <div className="relative bg-gradient-to-br from-gray-50 via-white to-gray-50/80 rounded-2xl p-6 md:p-7 border border-gray-200/60 shadow-md shadow-gray-200/20 hover:shadow-lg hover:shadow-gray-300/30 transition-all duration-300 hover:-translate-y-0.5">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 -mt-3 -mr-3 h-20 w-20 bg-gradient-to-br from-brand-secondary/8 to-brand-primary/8 rounded-full blur-2xl opacity-60" />
      <div className="absolute bottom-0 left-0 -mb-3 -ml-3 h-16 w-16 bg-gradient-to-tr from-brand-primary/5 to-brand-secondary/5 rounded-full blur-xl opacity-40" />
      
      <div className="relative space-y-4">
        {/* Header with icon */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200/60">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-secondary via-brand-secondary-hover to-brand-secondary flex items-center justify-center shadow-md shadow-brand-secondary/25 ring-2 ring-brand-secondary/10">
            <UserIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <h4 className="text-lg font-display font-bold text-gray-900 tracking-tight">User Style</h4>
        </div>
        
        {/* Content */}
        <div className="pt-2 space-y-5">
          {hasClothing && (
            <div id="style-clothing-type" className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Clothing style</span>
              </div>
              <div className="ml-6 text-sm capitalize">
                {!clothingStyle || clothingStyle === 'user-choice' ? (
                  <span className="inline-flex items-center gap-1.5 normal-case">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-gray-600">User choice</span>
                  </span>
                ) : (
                  <span className="text-gray-700 font-semibold">{getClothingPhrase(clothingStyle, clothingDetails) || ''}</span>
                )}
              </div>
              {clothingAccessories && clothingAccessories.length > 0 && (
                <div className="ml-6 text-sm text-gray-600 mt-1">Accessories: <span className="font-medium">{clothingAccessories.join(', ')}</span></div>
              )}
            </div>
          )}
          <div id="style-clothing-colors" className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Colors</span>
            </div>
            {(clothingColors && (clothingColors.topCover || clothingColors.topBase || clothingColors.bottom || ("shoes" in clothingColors && clothingColors.shoes))) ? (
                             <div className="ml-6 space-y-3">
                 {clothingColors.topCover && (
                   <div className="flex items-center gap-4">
                     <span className="w-16 text-sm font-medium text-gray-700">Cover</span>
                     {isHexColor(clothingColors.topCover) ? (
                       <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: clothingColors.topCover }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.topCover}</span>
                     )}
                   </div>
                 )}
                 {clothingColors.topBase && (
                   <div className="flex items-center gap-4">
                     <span className="w-16 text-sm font-medium text-gray-700">Base</span>
                     {isHexColor(clothingColors.topBase) ? (
                       <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: clothingColors.topBase }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.topBase}</span>
                     )}
                   </div>
                 )}
                 {clothingColors.bottom && (
                   <div className="flex items-center gap-4">
                     <span className="w-16 text-sm font-medium text-gray-700">Bottom</span>
                     {isHexColor(clothingColors.bottom) ? (
                       <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: clothingColors.bottom }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.bottom}</span>
                     )}
                   </div>
                 )}
                 {("shoes" in (clothingColors as Record<string, unknown>)) && clothingColors.shoes && (
                   <div className="flex items-center gap-4">
                     <span className="w-16 text-sm font-medium text-gray-700">Shoes</span>
                     {isHexColor(clothingColors.shoes) ? (
                       <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: clothingColors.shoes }} />
                     ) : (
                       <span className="text-gray-400">{clothingColors.shoes}</span>
                     )}
                   </div>
                 )}
               </div>
            ) : (
              <div className="ml-6 text-sm text-gray-600 inline-flex items-center gap-1.5">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                <span>User choice</span>
              </div>
            )}
          </div>
          {hasExpression && (
            <div id="style-expression" className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Expression</span>
              </div>
              <div className="ml-6 text-sm capitalize">
                {!expressionType || expressionType === 'user-choice' ? (
                  <span className="inline-flex items-center gap-1.5 normal-case">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-gray-600">User choice</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-gray-700 normal-case">
                    <span className="font-semibold">
                      {resolveExpression(expressionType)?.label ?? expressionType}
                    </span>
                    {resolveExpression(expressionType)?.description && (
                      <span className="relative inline-flex group">
                        <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-brand-secondary transition-colors cursor-help" />
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs leading-relaxed text-white opacity-0 shadow-2xl transition-opacity duration-200 group-hover:opacity-100">
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
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Lighting</span>
              </div>
              <div className="ml-6 text-sm capitalize">
                {!lightingType || lightingType === 'user-choice' ? (
                  <span className="inline-flex items-center gap-1.5 normal-case">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                    <span className="text-gray-600">User choice</span>
                  </span>
                ) : (
                  <span className="text-gray-700 font-semibold">{lightingType}</span>
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


