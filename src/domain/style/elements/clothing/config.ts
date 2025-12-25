import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'

export type KnownClothingStyle = 'business' | 'startup' | 'black-tie'

export interface WardrobeDetailConfig {
  details: string
  baseLayer: string
  outerLayer?: string
  notes?: string
  excludeClothingColors?: ClothingColorKey[]
}

export const CLOTHING_STYLES = [
  { value: 'business', label: 'Business', icon: '💼', color: 'from-blue-600 to-indigo-600', description: 'Professional attire' },
  { value: 'startup', label: 'Startup', icon: '👕', color: 'from-purple-500 to-pink-500', description: 'Casual & creative' },
  { value: 'black-tie', label: 'Black Tie', icon: '🎩', color: 'from-gray-800 to-gray-900', description: 'Formal elegance' }
] as const

export const CLOTHING_DETAILS: Record<string, { value: string; label: string }[]> = {
  business: [
    { value: 'formal', label: 'Formal' },
    { value: 'casual', label: 'Casual' }
  ],
  startup: [
    { value: 't-shirt', label: 'T-Shirt' },
    { value: 'hoodie', label: 'Hoodie' },
    { value: 'polo', label: 'Polo' },
    { value: 'button-down', label: 'Button Down' }
  ],
  'black-tie': [
    { value: 'tuxedo', label: 'Tuxedo' },
    { value: 'suit', label: 'Suit' },
    { value: 'dress', label: 'Dress' }
  ]
}

export const CLOTHING_ACCESSORIES: Record<string, string[]> = {
  business: ['tie', 'bowtie', 'blazer', 'vest', 'pocket-square', 'cufflinks'],
  startup: ['watch', 'glasses', 'hat'],
  'black-tie': ['bowtie', 'cufflinks', 'pocket-square', 'gloves']
}

export const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'dress', 'gown', 'jumpsuit'])

export const FALLBACK_DETAIL_BY_STYLE: Record<KnownClothingStyle, string> = {
  business: 'formal',
  startup: 't-shirt',
  'black-tie': 'suit'
}

export const WARDROBE_DETAILS: Record<KnownClothingStyle, Record<string, WardrobeDetailConfig>> = {
  business: {
    formal: {
      details: 'Tailored business suit ensemble with clean lines.',
      baseLayer: 'crisp dress shirt with subtle sheen',
      outerLayer: 'structured suit jacket fastened with a single button',
      notes: 'Pressed fabrics and polished appearance suitable for boardroom settings.'
    },
    casual: {
      details: 'High-end business-casual ensemble with modern styling. Do NOT add a tie or other accessories by default, only add them when specifically specified in the accessories section.',
      baseLayer: 'A deluxe T-Shirt. Substantial and refined, like Mercerized cotton, Pima cotton, or modal blends, with a tight crew neck',
      outerLayer: ' A single-breasted jacket with a subtle herringbone weave, adding a classic and refined touch to the overall look.',
      notes: 'Maintain relaxed but refined posture.'
    },
    blouse: {
      details: 'Polished blouse paired with tailored trousers or skirt',
      baseLayer: 'silk or satin blouse',
      outerLayer: 'structured blazer framing the neckline',
      notes: 'Keep jewelry minimal and ensure blouse remains smooth.'
    },
    dress: {
      details: 'Structured sheath dress with a corporate-ready silhouette',
      baseLayer: 'form-fitting dress bodice',
      notes: 'Optional lightweight blazer may be draped over shoulders.',
      excludeClothingColors: ['baseLayer']
    },
    pantsuit: {
      details: 'Contemporary tailored pantsuit with defined waist',
      baseLayer: 'sleek camisole or blouse beneath the suit jacket',
      outerLayer: 'matching blazer worn slightly open to reveal the base layer',
      notes: 'Maintain sharp creases and refined tailoring for an authoritative look.'
    }
  },
  startup: {
    't-shirt': {
      details: 'Modern startup look centered around a fitted crewneck tee',
      baseLayer: 'well-fitted crewneck t-shirt',
      notes: 'Keep silhouette clean and wrinkle-free; no outer layer required.',
      excludeClothingColors: ['baseLayer']
    },
    hoodie: {
      details: 'Casual startup hoodie outfit with relaxed confidence',
      baseLayer: 'premium hoodie',
      notes: 'Hood down, sleeves neat; keep presentation polished despite casual tone.',
      excludeClothingColors: ['baseLayer']
    },
    polo: {
      details: 'Smart casual polo ensemble',
      baseLayer: 'tailored short-sleeve polo with structured collar',
      notes: 'Buttons neat, collar crisp to balance relaxed and professional cues.',
      excludeClothingColors: ['baseLayer']
    },
    'button-down': {
      details: 'Casual button-down shirt worn open over a t-shirt',
      baseLayer: 'fitted t-shirt',
      outerLayer: 'lightweight button-down shirt worn open to frame the base layer',
      notes: 'Button-down sleeves can be crisp or subtly rolled; keep base layer visible.',
      excludeClothingColors: []
    },
    blouse: {
      details: 'Relaxed blouse with tailored trousers or midi skirt',
      baseLayer: 'flowy blouse',
      notes: 'Keep fabric smooth and opt for rolled sleeves to maintain an approachable tone.',
      excludeClothingColors: ['baseLayer']
    },
    cardigan: {
      details: 'Layered cardigan over a clean base garment',
      baseLayer: 'minimal knit dress or tee beneath the cardigan',
      outerLayer: 'open-front cardigan draped naturally',
      notes: 'Keep cardigan edges neat and balanced.',
      excludeClothingColors: []
    },
    dress: {
      details: 'Casual startup dress with a streamlined silhouette',
      baseLayer: 'knee-length knit dress',
      notes: 'Avoid busy patterns for a clean, professional look.',
      excludeClothingColors: ['baseLayer']
    },
    jumpsuit: {
      details: 'Modern startup jumpsuit with tailored bodice',
      baseLayer: 'structured jumpsuit torso',
      notes: 'Define the waist with a belt and keep accessories minimal.',
      excludeClothingColors: ['baseLayer']
    }
  },
  'black-tie': {
    tuxedo: {
      details: 'Classic black-tie tuxedo ensemble',
      baseLayer: 'pleated dress shirt with bow tie and subtle studs',
      outerLayer: 'satin-lapel tuxedo jacket fastened at the top button',
      notes: 'Include pocket square or lapel pin if colors are provided.'
    },
    suit: {
      details: 'Polished evening suit presentation',
      baseLayer: 'dress shirt with coordinating tie or bow tie',
      outerLayer: 'tailored suit jacket with structured shoulders',
      notes: 'Maintain sleek, pressed silhouette.'
    },
    dress: {
      details: 'Elegant evening dress suitable for black-tie events',
      baseLayer: 'floor-length formal dress with structured bodice',
      notes: 'Focus on graceful draping and refined fabrication.',
      excludeClothingColors: ['baseLayer']
    },
    gown: {
      details: 'Floor-length evening gown with dramatic draping',
      baseLayer: 'sleek gown bodice',
      notes: 'Pair with refined accessories; keep fabric smooth and well-draped.',
      excludeClothingColors: ['baseLayer']
    },
    jumpsuit: {
      details: 'Sophisticated formal jumpsuit',
      baseLayer: 'structured jumpsuit bodice',
      notes: 'Accentuate with statement belt or jewelry while maintaining a polished silhouette.',
      excludeClothingColors: ['baseLayer']
    }
  }
}

import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { deserialize } from './deserializer'

/**
 * Element registry config for clothing
 */
export const clothingElementConfig: ElementConfig<PhotoStyleSettings['clothing']> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults) {
      return { ...packageDefaults }
    }
    return { style: 'business' }
  },
  getDefaultUserChoice: () => ({ style: 'user-choice' }),
  deserialize
}
