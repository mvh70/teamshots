/**
 * Industry-specific headshot configuration
 *
 * Defines the professional look for each industry vertical.
 * All styling (background, clothing, pose, expression) is derived
 * from the industry selection.
 */

export type IndustryType =
  | 'law-firms'
  | 'medical'
  | 'real-estate'
  | 'financial-services'
  | 'actively-hiring'
  | 'consulting'
  | 'accounting'

export interface IndustrySettings {
  background: {
    type: 'office'
    prompt: string
  }
  clothing: {
    style: 'business' | 'startup'
    details: string
    colors: {
      topLayer: string
      baseLayer: string
    }
  }
  pose: {
    type: 'classic_corporate' | 'slimming_three_quarter' | 'power_cross' | 'candid_over_shoulder'
  }
  expression: {
    type: 'genuine_smile' | 'soft_smile' | 'neutral_serious'
  }
}

export const INDUSTRY_CONFIGS: Record<IndustryType, IndustrySettings> = {
  'law-firms': {
    background: {
      type: 'office',
      prompt:
        'Traditional law library with mahogany bookshelves, leather-bound books, warm ambient lighting, brass desk lamp, dignified professional atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'tailored charcoal suit jacket over crisp white blouse, professional and authoritative',
      colors: { topLayer: 'charcoal', baseLayer: 'white' },
    },
    pose: { type: 'slimming_three_quarter' },
    expression: { type: 'soft_smile' },
  },

  'medical': {
    background: {
      type: 'office',
      prompt:
        'Modern medical clinic with clean white walls, subtle medical equipment blurred in background, warm welcoming healthcare atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'pristine white lab coat over light blue dress shirt with stethoscope around neck',
      colors: { topLayer: 'white', baseLayer: 'light blue' },
    },
    pose: { type: 'classic_corporate' },
    expression: { type: 'soft_smile' },
  },

  'real-estate': {
    background: {
      type: 'office',
      prompt:
        'Modern real estate office with city skyline visible through floor-to-ceiling windows, golden hour lighting, professional yet approachable atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'elegant navy blazer over cream silk blouse, polished professional look',
      colors: { topLayer: 'navy', baseLayer: 'cream' },
    },
    pose: { type: 'slimming_three_quarter' },
    expression: { type: 'soft_smile' },
  },

  'financial-services': {
    background: {
      type: 'office',
      prompt:
        'Executive corner office with dark wood furniture, subtle financial displays, cityscape view, sophisticated corporate atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'navy pinstripe suit with burgundy tie and crisp white dress shirt, executive presence',
      colors: { topLayer: 'navy', baseLayer: 'white' },
    },
    pose: { type: 'power_cross' },
    expression: { type: 'soft_smile' },
  },

  'actively-hiring': {
    background: {
      type: 'office',
      prompt:
        'Modern startup office with exposed brick, plants, collaborative workspace with colorful post-its visible, energetic creative tech atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'startup',
      details: 'smart casual blazer over simple quality t-shirt, approachable tech professional',
      colors: { topLayer: 'gray', baseLayer: 'white' },
    },
    pose: { type: 'candid_over_shoulder' },
    expression: { type: 'soft_smile' },
  },

  'consulting': {
    background: {
      type: 'office',
      prompt:
        'Strategy consulting workshop room with whiteboard covered in frameworks, sticky notes on walls, conference table, dynamic collaborative atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'sharp charcoal blazer over light blue oxford shirt, no tie, smart professional',
      colors: { topLayer: 'charcoal', baseLayer: 'light blue' },
    },
    pose: { type: 'slimming_three_quarter' },
    expression: { type: 'soft_smile' },
  },

  'accounting': {
    background: {
      type: 'office',
      prompt:
        'Organized accounting office with neat stacks of documents, natural light through windows, potted plant, professional warm organized atmosphere. No studio lighting equipment, softboxes, or photography gear visible.',
    },
    clothing: {
      style: 'business',
      details: 'professional navy blazer over cream blouse with subtle pearl earrings, competent trustworthy',
      colors: { topLayer: 'navy', baseLayer: 'cream' },
    },
    pose: { type: 'classic_corporate' },
    expression: { type: 'soft_smile' },
  },
}

/**
 * Get industry config with fallback to law-firms
 */
export function getIndustryConfig(industry: string | undefined): IndustrySettings {
  if (industry && industry in INDUSTRY_CONFIGS) {
    return INDUSTRY_CONFIGS[industry as IndustryType]
  }
  return INDUSTRY_CONFIGS['law-firms']
}

/**
 * Check if a string is a valid industry type
 */
export function isValidIndustry(industry: string): industry is IndustryType {
  return industry in INDUSTRY_CONFIGS
}

/**
 * List of all available industries
 */
export const AVAILABLE_INDUSTRIES: IndustryType[] = Object.keys(INDUSTRY_CONFIGS) as IndustryType[]
