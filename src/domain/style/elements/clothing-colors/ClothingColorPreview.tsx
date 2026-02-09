'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getColorHex, type ColorValue, type ClothingColorKey } from './types'
import { normalizeColorToHex } from '@/lib/color-utils'

interface ClothingColorPreviewProps {
  colors: {
    topLayer?: string | ColorValue
    baseLayer?: string | ColorValue
    bottom?: string | ColorValue
    shoes?: string | ColorValue
  }
  clothingStyle: string // 'startup', 'business', etc.
  clothingDetail: string // 'hoodie', 'polo', 'button_down', 'casual'
  excludeColors?: ClothingColorKey[]
  className?: string
}

/**
 * Resolve a color to a valid CSS hex value.
 * getColorHex may return raw color names like 'Dark blue' which aren't valid CSS.
 * This ensures we always get a usable hex string.
 */
function resolveColorToHex(color: string | ColorValue | undefined): string | undefined {
  const raw = getColorHex(color)
  if (!raw) return undefined
  if (raw.startsWith('#')) return raw
  return normalizeColorToHex(raw)
}

// Individual clothing layer component with color overlay
function ClothingLayer({
  imagePath,
  color,
  label,
}: {
  imagePath: string
  color: string | ColorValue | undefined
  label: string
}) {
  const [imageExists, setImageExists] = useState(true)
  const [imageError, setImageError] = useState(false)
  const colorHex = resolveColorToHex(color)

  if (!imageExists || imageError) {
    return null
  }

  // If no color is provided, still show the image without color overlay
  if (!colorHex) {
    return null
  }

  return (
    <div className="relative mx-auto flex-shrink-0" style={{ width: '180px', height: '240px', minWidth: '180px', minHeight: '240px' }}>
      <div className="relative" style={{ width: '100%', height: '100%' }}>
        {/* Base clothing image */}
        <Image
          src={imagePath}
          alt={label}
          fill
          sizes="180px"
          className="object-contain"
          onError={() => {
            setImageExists(false)
            setImageError(true)
          }}
          unoptimized
        />

        {/* Color overlay using blend mode - masked by the image itself */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: colorHex,
            mixBlendMode: 'multiply',
            WebkitMaskImage: `url(${imagePath})`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: `url(${imagePath})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
          }}
        />
      </div>
    </div>
  )
}

export default function ClothingColorPreview({
  colors,
  clothingStyle,
  clothingDetail,
  excludeColors = [],
  className = '',
}: ClothingColorPreviewProps) {
  const templateId = `${clothingStyle}-${clothingDetail}`

  // Helper to check if a color should be shown
  const shouldShowColor = (colorKey: ClothingColorKey) => {
    return !excludeColors.includes(colorKey) && colors[colorKey]
  }

  // Helper to get layer image path (note: lowercase layer names in filenames)
  const getLayerImagePath = (layer: ClothingColorKey) => {
    return `/images/clothing/${templateId}-${layer.toLowerCase()}.png`
  }

  // Get layer labels
  const getLayerLabel = (layer: ClothingColorKey): string => {
    const labels: Record<ClothingColorKey, string> = {
      topLayer: 'Top Layer',
      baseLayer: 'Base Layer',
      bottom: 'Bottom',
      shoes: 'Shoes',
    }
    return labels[layer]
  }

  // Collect visible layers
  const visibleLayers: ClothingColorKey[] = ['topLayer', 'baseLayer', 'bottom', 'shoes'].filter(
    (layer) => shouldShowColor(layer as ClothingColorKey)
  ) as ClothingColorKey[]

  if (visibleLayers.length === 0) {
    return null
  }

  // Separate layers into groups
  const hasTopLayer = visibleLayers.includes('topLayer')
  const hasBaseLayer = visibleLayers.includes('baseLayer')
  const hasBottom = visibleLayers.includes('bottom')
  const hasShoes = visibleLayers.includes('shoes')

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: Stack all layers vertically */}
      <div className="flex flex-col gap-4 items-center md:hidden">
        {visibleLayers.map((layer) => (
          <ClothingLayer
            key={layer}
            imagePath={getLayerImagePath(layer)}
            color={colors[layer]}
            label={getLayerLabel(layer)}
          />
        ))}
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden md:block">
        {/* Row 1: Top layer and base layer side-by-side */}
        {(hasTopLayer || hasBaseLayer) && (
          <div className="flex gap-4 justify-center mb-4">
            {hasTopLayer && (
              <ClothingLayer
                imagePath={getLayerImagePath('topLayer')}
                color={colors.topLayer}
                label={getLayerLabel('topLayer')}
              />
            )}
            {hasBaseLayer && (
              <ClothingLayer
                imagePath={getLayerImagePath('baseLayer')}
                color={colors.baseLayer}
                label={getLayerLabel('baseLayer')}
              />
            )}
          </div>
        )}

        {/* Row 2: Bottom and shoes */}
        {(hasBottom || hasShoes) && (
          <div className="flex gap-4 justify-center">
            {hasBottom && (
              <ClothingLayer
                imagePath={getLayerImagePath('bottom')}
                color={colors.bottom}
                label={getLayerLabel('bottom')}
              />
            )}
            {hasShoes && (
              <ClothingLayer
                imagePath={getLayerImagePath('shoes')}
                color={colors.shoes}
                label={getLayerLabel('shoes')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
