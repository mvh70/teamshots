'use client'

import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { getElementMetadata } from '@/domain/style/elements'
import { isUserChoice, hasValue } from '@/domain/style/elements/base/element-types'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { getWardrobeExclusions } from '@/domain/style/elements/clothing/prompt'
import type { KnownClothingStyle } from '@/domain/style/elements/clothing/config'
import { ClothingColorsSummary } from '@/domain/style/elements/clothing-colors/Summary'
import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import type { PhotoStyleSettings } from '@/types/photo-style'

interface UserStyleSummaryProps {
  settings?: Partial<PhotoStyleSettings> | null
}

// User style elements in display order (excluding clothingColors which we handle specially)
const USER_STYLE_ELEMENTS = [
  'clothing',
  'customClothing',
  'expression',
  'lighting'
] as const

export default function UserStyleSummary({ settings }: UserStyleSummaryProps) {
  if (!settings) return null

  // Extract clothing value from wrapper (if present and has value)
  const clothingWrapper = settings.clothing
  const clothingHasValue = clothingWrapper && hasValue(clothingWrapper)
  const clothingStyle = clothingHasValue ? clothingWrapper.value.style : undefined
  const clothingDetails = clothingHasValue ? clothingWrapper.value.details : undefined
  const clothingAccessories = clothingHasValue ? clothingWrapper.value.accessories : undefined
  const clothingIsUserChoice = clothingWrapper ? isUserChoice(clothingWrapper) : false
  const lightingType = settings.lighting?.value?.type
  const hasClothingSettings = settings.clothing !== undefined
  const hasLighting = settings.lighting !== undefined

  // Compute excluded clothing colors based on shot type and clothing style
  const excludedClothingColors = React.useMemo<ClothingColorKey[]>(() => {
    const exclusions = new Set<ClothingColorKey>()

    const shotTypeValue = hasValue(settings.shotType) ? settings.shotType.value.type : undefined

    if (shotTypeValue) {
      const shotTypeConfig = resolveShotType(shotTypeValue)
      if (shotTypeConfig.excludeClothingColors) {
        shotTypeConfig.excludeClothingColors.forEach(c => exclusions.add(c as ClothingColorKey))
      }
    }

    if (clothingStyle) {
      const knownStyle = clothingStyle as KnownClothingStyle
      const wardrobeExclusions = getWardrobeExclusions(knownStyle, clothingDetails)
      wardrobeExclusions.forEach(c => exclusions.add(c as ClothingColorKey))
    }

    return Array.from(exclusions)
  }, [settings.shotType, clothingStyle, clothingDetails])

  const getClothingPhrase = (style?: string, details?: string): string | undefined => {
    if (!style && !details) return undefined
    const norm = (s: string | undefined) => (s || '').trim().toLowerCase()
    const s = norm(style)
    let d = norm(details)

    if (d === 'buttondown' || d === 'button-down' || d === 'button down shirt') d = 'button down'
    if (d === 'tshirt' || d === 't-shirt') d = 't-shirt'
    if (d === 'suit jacket') d = 'suit'

    const styleLabel = s === 'black-tie' ? 'Black tie' : s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
    const detailLabel = d ? d.charAt(0).toUpperCase() + d.slice(1) : ''

    if (!styleLabel) return detailLabel || undefined
    if (!detailLabel) return styleLabel
    return `${styleLabel} — ${detailLabel}`
  }

  // Setting row component for consistent styling
  const SettingRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-[13px] text-gray-500">{label}</span>
      <div className="text-[13px] text-right">{children}</div>
    </div>
  )

  // User choice indicator
  const UserChoiceIndicator = () => (
    <span className="inline-flex items-center gap-1.5 text-amber-600">
      <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>User choice</span>
    </span>
  )

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
      {/* Refined header with gradient background */}
      <div className="relative px-5 py-4 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 border-b border-gray-100 rounded-t-2xl overflow-hidden">
        {/* Subtle decorative element */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-brand-secondary/[0.03] to-transparent rounded-bl-full" />

        <div className="relative flex items-center gap-3.5">
          {/* Icon with refined treatment */}
          <div className="relative flex-shrink-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-secondary/10 via-brand-secondary/5 to-transparent flex items-center justify-center border border-brand-secondary/10">
              <SparklesIcon className="h-5 w-5 text-brand-secondary" strokeWidth={1.75} />
            </div>
          </div>

          {/* Title */}
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-gray-800 tracking-wide uppercase">
              User Style
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">Appearance options</p>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-5 py-4 flex-1">
        <div className="space-y-0">
          {/* Render elements using registry */}
          {USER_STYLE_ELEMENTS.map((elementKey) => {
            const metadata = getElementMetadata(elementKey)
            if (!metadata) return null

            // Use registered summary component if available
            if (metadata.summaryComponent) {
              const SummaryComponent = metadata.summaryComponent
              const elementSettings = settings[elementKey]

              if (elementKey === 'customClothing') {
                if (!elementSettings) return null
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

            // Fallback for elements without summary components
            if (elementKey === 'clothing' && hasClothingSettings) {
              return (
                <React.Fragment key="clothing">
                  <SettingRow label="Clothing">
                    {clothingIsUserChoice || !clothingStyle ? (
                      <UserChoiceIndicator />
                    ) : (
                      <div className="text-right">
                        <span className="text-gray-800 font-medium">{getClothingPhrase(clothingStyle, clothingDetails) || ''}</span>
                        {clothingAccessories && clothingAccessories.length > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5">{clothingAccessories.join(', ')}</div>
                        )}
                      </div>
                    )}
                  </SettingRow>
                  {settings.clothingColors && (
                    <ClothingColorsSummary
                      settings={settings.clothingColors}
                      excludeColors={excludedClothingColors}
                    />
                  )}
                </React.Fragment>
              )
            }

            if (elementKey === 'lighting' && hasLighting) {
              return (
                <SettingRow key="lighting" label="Lighting">
                  {!lightingType ? (
                    <UserChoiceIndicator />
                  ) : (
                    <span className="text-gray-800 font-medium capitalize">{lightingType}</span>
                  )}
                </SettingRow>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
