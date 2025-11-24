export interface ClothingColorSettings {
  type: 'predefined' | 'user-choice'
  colors?: {
    topCover?: string // Outer layer color (blazer, jacket, etc.)
    topBase?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
}

