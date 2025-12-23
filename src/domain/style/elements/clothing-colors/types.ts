export type ClothingColorKey = 'topLayer' | 'baseLayer' | 'bottom' | 'shoes'

export interface ClothingColorSettings {
  type: 'predefined' | 'user-choice'
  colors?: {
    topLayer?: string // Top layer color - the visible outer garment (jacket, blazer, hoodie, polo, etc.)
    baseLayer?: string // Base layer color - shirt underneath outer layer (only for multi-layer outfits)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
}

