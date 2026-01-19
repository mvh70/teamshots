import type {
  ClothingColorValue,
  ShotTypeValue
} from '@/types/photo-style'
import type { WardrobeDetailConfig } from '../clothing/config'
import { NO_TOP_COVER_DETAILS } from '../clothing/prompt'

const isFullBodyVisible = (shotType?: ShotTypeValue | null) =>
  shotType === 'full-body' || shotType === 'full-length' || shotType === 'wide-shot'

const isBottomVisible = (shotType?: ShotTypeValue | null) =>
  isFullBodyVisible(shotType) || shotType === 'midchest' || shotType === 'three-quarter'

/**
 * Check if shot type may partially show bottom garments
 * These are "edge case" shots where the frame cuts near the waistline,
 * so trousers/skirts might be partially visible even though not intended.
 */
const mayPartiallyShowBottom = (shotType?: ShotTypeValue | null) =>
  shotType === 'medium-shot' // Waist-level cut - trousers may be partially visible

export const buildColorPalette = (
  colors: ClothingColorValue | undefined,
  detailKey: string,
  descriptor: WardrobeDetailConfig,
  shotType?: ShotTypeValue | null
): string[] | undefined => {
  if (!colors) return undefined
  const palette: string[] = []

  // Top layer - the visible outer garment (always present)
  if (colors.topLayer) {
    palette.push(`top_layer (${detailKey}): ${colors.topLayer} color`)
  }

  // Base layer - shirt underneath (only for multi-layer garments)
  if (colors.baseLayer) {
    palette.push(`base_layer (shirt underneath): ${colors.baseLayer} color`)
  }

  if (colors.bottom && isBottomVisible(shotType)) {
    // Fully visible - include color as primary specification
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colors.bottom} color`)
  } else if (colors.bottom && mayPartiallyShowBottom(shotType)) {
    // Edge case: shot cuts near waistline - bottom may be partially visible
    // Include color as fallback to ensure consistency if AI shows any trousers
    palette.push(`bottom garment if partially visible (trousers, skirt): ${colors.bottom} color`)
  }

  if (colors.shoes && isFullBodyVisible(shotType)) {
    palette.push(`shoes (dress shoes, loafers, heels): ${colors.shoes} color`)
  }

  return palette.length > 0 ? palette : undefined
}

