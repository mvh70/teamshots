import type {
  ClothingColorSettings,
  ShotTypeValue
} from '@/types/photo-style'
import type { WardrobeDetailConfig } from '../clothing/config'
import { NO_TOP_COVER_DETAILS } from '../clothing/prompt'

const isFullBodyVisible = (shotType?: ShotTypeValue | null) =>
  shotType === 'full-body' || shotType === 'full-length' || shotType === 'wide-shot'

const isBottomVisible = (shotType?: ShotTypeValue | null) =>
  isFullBodyVisible(shotType) || shotType === 'midchest' || shotType === 'three-quarter'

export const buildColorPalette = (
  colors: ClothingColorSettings['colors'] | undefined,
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
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colors.bottom} color`)
  }

  if (colors.shoes && isFullBodyVisible(shotType)) {
    palette.push(`shoes (dress shoes, loafers, heels): ${colors.shoes} color`)
  }

  return palette.length > 0 ? palette : undefined
}

