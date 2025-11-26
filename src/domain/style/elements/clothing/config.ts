
export type KnownClothingStyle = 'business' | 'startup' | 'black-tie'

export interface WardrobeDetailConfig {
  details: string
  baseLayer: string
  outerLayer?: string
  notes?: string
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

export const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down', 'dress', 'gown', 'jumpsuit'])

export const FALLBACK_DETAIL_BY_STYLE: Record<KnownClothingStyle, string> = {
  business: 'formal',
  startup: 't-shirt',
  'black-tie': 'suit'
}

export const WARDROBE_DETAILS: Record<KnownClothingStyle, Record<string, WardrobeDetailConfig>> = {
  business: {
    formal: {
      details: 'Tailored business suit ensemble with clean lines. Do NOT add a tie by default, only add it when specifificially specified in the accessories section.',
      baseLayer: 'crisp dress shirt with subtle sheen',
      outerLayer: 'structured suit jacket fastened with a single button',
      notes: 'Pressed fabrics and polished appearance suitable for boardroom settings.'
    },
    casual: {
      details: 'Smart business-casual outfit with relaxed tailoring',
      baseLayer: 'premium knit top or blouse ideal for tasteful logo placement',
      outerLayer: 'unstructured blazer worn open for an approachable look',
      notes: 'No tie; maintain relaxed but refined posture.'
    },
    blouse: {
      details: 'Polished blouse paired with tailored trousers or skirt',
      baseLayer: 'silk or satin blouse ready for subtle left-chest embroidery',
      outerLayer: 'structured blazer framing the neckline and logo',
      notes: 'Keep jewelry minimal and ensure blouse remains smooth around the logo.'
    },
    dress: {
      details: 'Structured sheath dress with a corporate-ready silhouette',
      baseLayer: 'form-fitting dress bodice suited for embroidered crest placement',
      notes: 'Optional lightweight blazer may be draped over shoulders without covering the logo.'
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
      baseLayer: 'well-fitted crewneck t-shirt ready for central logo placement',
      notes: 'Keep silhouette clean and wrinkle-free; no outer layer required.'
    },
    hoodie: {
      details: 'Casual startup hoodie outfit with relaxed confidence',
      baseLayer: 'premium hoodie layered over a minimal base tee',
      notes: 'Hood down, sleeves neat; keep presentation polished despite casual tone.'
    },
    polo: {
      details: 'Smart casual polo ensemble',
      baseLayer: 'tailored short-sleeve polo with structured collar',
      notes: 'Buttons neat, collar crisp to balance relaxed and professional cues.'
    },
    'button-down': {
      details: 'Crisp startup button-down outfit',
      baseLayer: 'lightweight button-down shirt neatly pressed',
      outerLayer: 'optional lightweight jacket or overshirt left open',
      notes: 'Sleeves either crisp or subtly rolled, matching brand tone.'
    },
    blouse: {
      details: 'Relaxed blouse with tailored trousers or midi skirt',
      baseLayer: 'flowy blouse designed for centered or left-chest branding',
      notes: 'Keep fabric smooth and opt for rolled sleeves to maintain an approachable tone.'
    },
    cardigan: {
      details: 'Layered cardigan over a clean base garment',
      baseLayer: 'minimal knit dress or tee beneath the cardigan',
      outerLayer: 'open-front cardigan draped naturally to frame the logo',
      notes: 'Ensure cardigan edges do not obscure the logo placement.'
    },
    dress: {
      details: 'Casual startup dress with a streamlined silhouette',
      baseLayer: 'knee-length knit dress ideal for centered logo application',
      notes: 'Avoid busy patterns so the branding stays legible.'
    },
    jumpsuit: {
      details: 'Modern startup jumpsuit with tailored bodice',
      baseLayer: 'structured jumpsuit torso suited for subtle embroidery',
      notes: 'Define the waist with a belt and keep accessories minimal.'
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
      notes: 'Focus on graceful draping and refined fabrication.'
    },
    gown: {
      details: 'Floor-length evening gown with dramatic draping',
      baseLayer: 'sleek gown bodice that supports delicate embroidery',
      notes: 'Pair with refined accessories; keep fabric smooth around the logo area.'
    },
    jumpsuit: {
      details: 'Sophisticated formal jumpsuit',
      baseLayer: 'structured jumpsuit bodice tailored for elegant branding',
      notes: 'Accentuate with statement belt or jewelry while maintaining a polished silhouette.'
    }
  }
}
