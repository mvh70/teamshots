'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getColorHex, type ColorValue, type ClothingColorKey } from './types'
import { normalizeColorToHex } from '@/lib/color-utils'
import type { ClothingStyle, ClothingValue } from '@/domain/style/elements/clothing/types'
import { getEffectiveClothingMode, getPreviewTemplateForLayer } from '@/domain/style/elements/clothing/config'

interface ClothingColorPreviewProps {
  colors: {
    topLayer?: string | ColorValue
    baseLayer?: string | ColorValue
    bottom?: string | ColorValue
    shoes?: string | ColorValue
  }
  clothingStyle: ClothingStyle
  clothingDetail?: string // legacy fallback detail key
  clothingValue?: Partial<ClothingValue>
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

export function shouldPreferTopLayerForBasePreview(topChoice?: string, hasOuterLayer = false): boolean {
  // When an outer layer is selected, always favor the base-layer mask first.
  // This avoids showing the outer garment (e.g. jacket) in the base-layer preview slot.
  if (hasOuterLayer) return false

  const normalized = topChoice?.toLowerCase()
  return (
    normalized === 't-shirt' ||
    normalized === 'button-down' ||
    normalized === 'polo' ||
    normalized === 'blouse' ||
    normalized === 'hoodie' ||
    normalized === 'silk-blouse'
  )
}

// Individual clothing layer component with color overlay
function ClothingLayer({
  imagePaths,
  color,
  label,
}: {
  imagePaths: string[]
  color: string | ColorValue | undefined
  label: string
}) {
  const [imagePathIndex, setImagePathIndex] = useState(0)
  const colorHex = resolveColorToHex(color)
  const activeImagePath = imagePaths[imagePathIndex]

  // Reset fallback state when layer candidates change.
  useEffect(() => {
    setImagePathIndex(0)
  }, [imagePaths])

  if (!activeImagePath) {
    return null
  }

  return (
    <div className="relative mx-auto flex-shrink-0" style={{ width: '180px', height: '240px', minWidth: '180px', minHeight: '240px' }}>
      <div className="relative" style={{ width: '100%', height: '100%' }}>
        {/* Base clothing image */}
        <Image
          src={activeImagePath}
          alt={label}
          fill
          sizes="180px"
          className="object-contain"
          onError={() => {
            setImagePathIndex((current) => current + 1)
          }}
          unoptimized
        />

        {/* Color overlay using blend mode - masked by the image itself */}
        {colorHex && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: colorHex,
              mixBlendMode: 'multiply',
              WebkitMaskImage: `url(${activeImagePath})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskImage: `url(${activeImagePath})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function ClothingColorPreview({
  colors,
  clothingStyle,
  clothingDetail,
  clothingValue,
  excludeColors = [],
  className = '',
}: ClothingColorPreviewProps) {
  const clothingForPreview: Partial<ClothingValue> = {
    ...(clothingValue || {}),
    style: clothingStyle,
    details: clothingDetail,
  }
  const mode = getEffectiveClothingMode(clothingForPreview)
  const hasOuterLayer = mode !== 'one_piece' && !!clothingForPreview.outerChoice
  const hideOuterLayerImage = mode === 'separate' && !hasOuterLayer

  // Layer visibility is style/shot driven (excludeColors), never color driven.
  // If a color is missing, the layer still renders using the default white asset.
  const shouldShowLayer = (colorKey: ClothingColorKey) => {
    if (mode === 'one_piece' && (colorKey === 'baseLayer' || colorKey === 'bottom')) {
      return false
    }
    if (hideOuterLayerImage && colorKey === 'topLayer') {
      return false
    }
    if (hideOuterLayerImage && colorKey === 'baseLayer') {
      return true
    }
    return !excludeColors.includes(colorKey)
  }

  // Helper to get layer image path candidates (note: lowercase layer names in filenames)
  const getLayerImagePaths = (layer: ClothingColorKey): string[] => {
    if (layer === 'shoes') {
      return []
    }

    // One-piece outfits do not have a base layer.
    if (mode === 'one_piece' && layer === 'baseLayer') {
      return []
    }

    const resolvedTemplateDetail = getPreviewTemplateForLayer(
      clothingForPreview,
      layer as 'topLayer' | 'baseLayer' | 'bottom'
    )
    const templateDetail = resolvedTemplateDetail || clothingDetail

    if (!templateDetail) {
      return []
    }

    const primaryPath = `/images/clothing/${clothingStyle}-${templateDetail}-${layer.toLowerCase()}.webp`
    if (layer === 'baseLayer') {
      const fallbackTopLayerPath = `/images/clothing/${clothingStyle}-${templateDetail}-toplayer.webp`
      const preferTopLayer = shouldPreferTopLayerForBasePreview(clothingForPreview.topChoice, hasOuterLayer)
      return preferTopLayer
        ? [fallbackTopLayerPath, primaryPath]
        : [primaryPath, fallbackTopLayerPath]
    }

    return [primaryPath]
  }

  const getLayerColor = (layer: ClothingColorKey): string | ColorValue | undefined => {
    if (hideOuterLayerImage && layer === 'baseLayer') {
      return colors.baseLayer
    }
    return colors[layer]
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
    (layer) => shouldShowLayer(layer as ClothingColorKey) && getLayerImagePaths(layer as ClothingColorKey).length > 0
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
            imagePaths={getLayerImagePaths(layer)}
            color={getLayerColor(layer)}
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
                imagePaths={getLayerImagePaths('topLayer')}
                color={getLayerColor('topLayer')}
                label={getLayerLabel('topLayer')}
              />
            )}
            {hasBaseLayer && (
              <ClothingLayer
                imagePaths={getLayerImagePaths('baseLayer')}
                color={getLayerColor('baseLayer')}
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
                imagePaths={getLayerImagePaths('bottom')}
                color={getLayerColor('bottom')}
                label={getLayerLabel('bottom')}
              />
            )}
            {hasShoes && (
              <ClothingLayer
                imagePaths={getLayerImagePaths('shoes')}
                color={getLayerColor('shoes')}
                label={getLayerLabel('shoes')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
