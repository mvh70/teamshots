import type {
  ClothingColorSettings,
  ShotTypeValue
} from '@/types/photo-style'
import { WardrobeDetailConfig, NO_TOP_COVER_DETAILS } from '../clothing/config'

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

  // Always add base layer color if provided
  if (colors.topBase) {
    palette.push(`base layer (e.g., shirt under hoodie, dress shirt under blazer): ${colors.topBase} color`)
  }

  // Handle topCover color based on garment type
  if (colors.topCover) {
    if (NO_TOP_COVER_DETAILS.has(detailKey)) {
      // For items like hoodie, t-shirt, dress - topCover is the main garment color
      palette.push(`${detailKey} (the main visible garment): ${colors.topCover} color`)
    } else if (descriptor.outerLayer) {
      // For items with separate outer layer (jacket, blazer, etc.)
      palette.push(`outer layer (e.g., suit jacket, blazer, cardigan): ${colors.topCover} color`)
    }
  }

  if (colors.bottom && isBottomVisible(shotType)) {
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colors.bottom} color`)
  }

  if (colors.shoes && isFullBodyVisible(shotType)) {
    palette.push(`shoes (dress shoes, loafers, heels): ${colors.shoes} color`)
  }

  return palette.length > 0 ? palette : undefined
}

