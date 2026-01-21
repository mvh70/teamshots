'use client'

import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import type { ClothingColorSettings, ColorValue, ClothingColorKey } from './types'
import { getColorHex } from './types'
import { hasValue, isUserChoice } from '../base/element-types'
import { normalizeColorToHex, hexToColorName } from '@/lib/color-utils'

export interface ClothingColorsSummaryProps extends ElementSummaryProps<ClothingColorSettings> {
  excludeColors?: ClothingColorKey[]
}

function getDisplayHex(color: string | ColorValue | undefined): string | undefined {
  const rawValue = getColorHex(color)
  if (!rawValue) return undefined
  if (rawValue.startsWith('#')) return rawValue
  return normalizeColorToHex(rawValue)
}

function getColorName(color: string | ColorValue | undefined): string {
  const rawValue = getColorHex(color)
  if (!rawValue) return 'Unknown'
  if (!rawValue.startsWith('#')) {
    return rawValue.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }
  return hexToColorName(rawValue)
}

export function ClothingColorsSummary({ settings, excludeColors = [] }: ClothingColorsSummaryProps) {
  const [hoveredColor, setHoveredColor] = React.useState<string | null>(null)

  if (!settings || isUserChoice(settings)) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
        <span className="text-[13px] text-gray-500">Colors</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-amber-600">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>User choice</span>
        </span>
      </div>
    )
  }

  const colors = hasValue(settings) ? settings.value : undefined

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

  const visibleColors: Array<{ key: string; label: string; hex: string | undefined; name: string }> = []
  if (colors) {
    if (shouldShow('topLayer', colors.topLayer)) {
      visibleColors.push({ key: 'topLayer', label: 'Top', hex: getDisplayHex(colors.topLayer), name: getColorName(colors.topLayer) })
    }
    if (shouldShow('baseLayer', colors.baseLayer)) {
      visibleColors.push({ key: 'baseLayer', label: 'Base', hex: getDisplayHex(colors.baseLayer), name: getColorName(colors.baseLayer) })
    }
    if (shouldShow('bottom', colors.bottom)) {
      visibleColors.push({ key: 'bottom', label: 'Bottom', hex: getDisplayHex(colors.bottom), name: getColorName(colors.bottom) })
    }
    if (shouldShow('shoes', colors.shoes)) {
      visibleColors.push({ key: 'shoes', label: 'Shoes', hex: getDisplayHex(colors.shoes), name: getColorName(colors.shoes) })
    }
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-[13px] text-gray-500">Colors</span>
      {hasAnyVisibleColor ? (
        <div className="flex items-center gap-1.5">
          {visibleColors.map(({ key, label, hex, name }) => (
            <div
              key={key}
              className="relative group"
              onMouseEnter={() => setHoveredColor(key)}
              onMouseLeave={() => setHoveredColor(null)}
            >
              <div
                className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-default transition-transform group-hover:scale-110"
                style={{ backgroundColor: hex }}
              />
              {/* Tooltip */}
              <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap shadow-lg z-50 transition-all duration-150 ${hoveredColor === key ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}>
                <span className="text-gray-400">{label}:</span> {name}
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-amber-600">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Not set</span>
        </span>
      )}
    </div>
  )
}
