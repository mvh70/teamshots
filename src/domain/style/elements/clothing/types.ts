export interface ClothingSettings {
  type?: 'business' | 'startup' | 'black-tie' | 'user-choice'
  style: 'business' | 'startup' | 'black-tie' | 'user-choice'
  details?: string // Style-specific detail (e.g., 'formal', 'casual', 't-shirt', 'hoodie', 'tuxedo', 'suit')
  colors?: {
    topLayer?: string // Outer layer color (blazer, jacket, etc.)
    baseLayer?: string // Base layer color (shirt, t-shirt, etc.)
    bottom?: string // Bottom color (pants, skirt, etc.)
    shoes?: string // Shoes color
  }
  accessories?: string[] // Style-dependent accessories
}

