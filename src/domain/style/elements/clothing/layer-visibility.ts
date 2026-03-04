import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { getWardrobeExclusions } from './prompt'
import type { ClothingValue } from './types'
import { getEffectiveClothingMode } from './config'

interface ResolveExcludedClothingColorsParams {
  shotType?: string
  clothingStyle?: string
  clothingDetail?: string
  clothingValue?: Partial<ClothingValue>
}

/**
 * Resolve clothing color/layer exclusions from both:
 * 1) shot-type framing constraints
 * 2) clothing style/detail wardrobe constraints
 */
export function resolveExcludedClothingColors(
  params: ResolveExcludedClothingColorsParams
): ClothingColorKey[] {
  const exclusions = new Set<ClothingColorKey>()

  if (params.shotType) {
    const shotTypeConfig = resolveShotType(params.shotType)
    if (shotTypeConfig.excludeClothingColors) {
      shotTypeConfig.excludeClothingColors.forEach((key) => exclusions.add(key))
    }
  }

  if (params.clothingStyle) {
    const wardrobeExclusions = getWardrobeExclusions(
      params.clothingStyle,
      params.clothingDetail
    )
    wardrobeExclusions.forEach((key) => exclusions.add(key))
  }

  // In separate mode, "No top layer" means the optional outer/top garment is disabled.
  // Hide its color control so users only configure visible garment layers.
  if (params.clothingValue) {
    const mode = getEffectiveClothingMode(params.clothingValue)
    if (mode === 'one_piece') {
      exclusions.add('baseLayer')
      exclusions.add('bottom')
    }
    if (mode === 'separate' && !params.clothingValue.outerChoice) {
      exclusions.add('topLayer')
    }
  }

  return Array.from(exclusions)
}
