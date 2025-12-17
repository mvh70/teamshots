'use client'

import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { UserIcon } from '@heroicons/react/24/outline'
import { getElementMetadata } from '@/domain/style/elements'
import type { PhotoStyleSettings } from '@/types/photo-style'
interface UserStyleSummaryProps {
  settings?: Partial<PhotoStyleSettings> | null
}

// User style elements in display order
const USER_STYLE_ELEMENTS = [
  'clothing',
  'customClothing',
  'clothingColors',
  'expression',
  'lighting'
] as const

export default function UserStyleSummary({ settings }: UserStyleSummaryProps) {
  if (!settings) return null

  const clothingStyle = settings.clothing?.style
  const clothingDetails = settings.clothing?.details
  const clothingAccessories = settings.clothing?.accessories
  const lightingType = settings.lighting?.type
  const hasClothing = settings.clothing !== undefined
  const hasLighting = settings.lighting !== undefined

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
          {/* Render elements using registry */}
          {USER_STYLE_ELEMENTS.map((elementKey) => {
            const metadata = getElementMetadata(elementKey)
            if (!metadata) return null

            // Use registered summary component if available
            if (metadata.summaryComponent) {
              const SummaryComponent = metadata.summaryComponent
              const elementSettings = settings[elementKey]
              
              // For customClothing, always pass settings if they exist (Summary component handles visibility logic)
              // For other elements, only show if settings exist
              if (elementKey === 'customClothing') {
                if (!elementSettings) return null
                // Pass settings even if just { type: 'user-choice' } - let Summary component decide
              } else {
                if (!elementSettings) return null
              }

              return (
                <SummaryComponent
                  key={elementKey}
                  settings={elementSettings}
                />
              )
            }

            // Fallback for elements without summary components yet
            if (elementKey === 'clothing' && hasClothing) {
              return (
                <div key="clothing" id="style-clothing-type" className="flex flex-col space-y-2">
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
              )
            }

            if (elementKey === 'lighting' && hasLighting) {
              return (
                <div key="lighting" className="flex flex-col space-y-2">
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
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}


