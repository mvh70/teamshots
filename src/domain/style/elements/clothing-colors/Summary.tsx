'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import type { ClothingColorSettings } from './types'

function isHexColor(value?: string): boolean {
  if (!value) return false
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

export function ClothingColorsSummary({ settings }: ElementSummaryProps<ClothingColorSettings>) {
  const colors = settings?.colors

  return (
    <div id="style-clothing-colors" className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Colors</span>
      </div>
      {(colors && (colors.topCover || colors.topBase || colors.bottom || ("shoes" in colors && colors.shoes))) ? (
        <div className="ml-6 flex flex-wrap items-center gap-4">
          {colors.topCover && (
            <div className="flex flex-col items-center gap-1">
              {isHexColor(colors.topCover) ? (
                <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: colors.topCover }} />
              ) : (
                <span className="text-gray-400 text-xs">{colors.topCover}</span>
              )}
              <span className="text-xs font-medium text-gray-600">Cover</span>
            </div>
          )}
          {colors.topBase && (
            <div className="flex flex-col items-center gap-1">
              {isHexColor(colors.topBase) ? (
                <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: colors.topBase }} />
              ) : (
                <span className="text-gray-400 text-xs">{colors.topBase}</span>
              )}
              <span className="text-xs font-medium text-gray-600">Base</span>
            </div>
          )}
          {colors.bottom && (
            <div className="flex flex-col items-center gap-1">
              {isHexColor(colors.bottom) ? (
                <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: colors.bottom }} />
              ) : (
                <span className="text-gray-400 text-xs">{colors.bottom}</span>
              )}
              <span className="text-xs font-medium text-gray-600">Bottom</span>
            </div>
          )}
          {("shoes" in (colors as Record<string, unknown>)) && colors.shoes && (
            <div className="flex flex-col items-center gap-1">
              {isHexColor(colors.shoes) ? (
                <div className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer ring-2 ring-transparent hover:ring-gray-200" style={{ backgroundColor: colors.shoes }} />
              ) : (
                <span className="text-gray-400 text-xs">{colors.shoes}</span>
              )}
              <span className="text-xs font-medium text-gray-600">Shoes</span>
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
  )
}
