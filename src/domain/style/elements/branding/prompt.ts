import type { BrandingSettings } from '@/types/photo-style'
import { KnownClothingStyle } from '../clothing/config'
import { BACKGROUND_BRANDING_PROMPT, ELEMENT_BRANDING_PROMPT, CLOTHING_BRANDING_RULES_BASE } from './config'

type ClothingBrandingConfig = {
  placement: string
  rules: string[]
}

// Repository pattern for branding configurations
const BRANDING_CONFIGS: Record<string, ClothingBrandingConfig> = {
  // Default fallback
  'default': {
    placement: 'left chest or center chest',
    rules: CLOTHING_BRANDING_RULES_BASE
  },

  // Business style configurations
  'business-dress': {
    placement: 'upper-left chest of the dress as a subtle embroidered crest',
    rules: [
      'Integrate the logo as a tasteful embroidered mark on the dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep surrounding fabric smooth so the crest remains crisp.'
    ]
  },
  'business-formal': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-pantsuit': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-blouse': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'business-casual': {
    placement: 'center chest area of the base layer (t-shirt, knit top, or blouse). The logo should not spill over the edge of the garment. For more realistic effect, part of the logo can be hidden behind the top layer.',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the base garment.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },

  // Startup style configurations
  'startup-t-shirt': {
    placement: 'center chest area of the base garment (t-shirt, hoodie, polo, button-down)',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the base garment.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-hoodie': {
    placement: 'center chest area of the base garment (t-shirt, hoodie, polo, button-down)',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the base garment.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-polo': {
    placement: 'center chest area of the base garment (t-shirt, hoodie, polo, button-down)',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the base garment.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'startup-button-down': {
    placement: 'center chest area of the base garment (t-shirt, hoodie, polo, button-down)',
    rules: [
      'Place the provided brand logo exactly once on the center chest area of the base garment.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },

  // Black-tie style configurations
  'black-tie-dress': {
    placement: 'upper-left chest of the gown as an elegant embroidered crest',
    rules: [
      'Integrate the logo as a tasteful applique on the gown or dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'black-tie-gown': {
    placement: 'upper-left chest of the gown as an elegant embroidered crest',
    rules: [
      'Integrate the logo as a tasteful applique on the gown or dress bodice.',
      ...CLOTHING_BRANDING_RULES_BASE
    ]
  },
  'black-tie-tuxedo': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  },
  'black-tie-suit': {
    placement: 'upper-right chest of the base dress shirt, positioned where a shirt pocket would be',
    rules: [
      'Put the logo on the visible base shirt only (not on the jacket), positioned on the upper-right chest where a shirt pocket would be.',
      ...CLOTHING_BRANDING_RULES_BASE,
      'Keep the jacket partially open so the logo remains visible.'
    ]
  }
}

export function resolveClothingBrandingConfig(styleKey: KnownClothingStyle | undefined, detailKey?: string): ClothingBrandingConfig {
  if (!styleKey) {
    return BRANDING_CONFIGS.default
  }

  // Try specific style-detail combination first
  const specificKey = `${styleKey}-${detailKey}` as keyof typeof BRANDING_CONFIGS
  if (BRANDING_CONFIGS[specificKey]) {
    return BRANDING_CONFIGS[specificKey]
  }

  // Try style-default fallback
  const defaultKey = `${styleKey}-default` as keyof typeof BRANDING_CONFIGS
  if (BRANDING_CONFIGS[defaultKey]) {
    return BRANDING_CONFIGS[defaultKey]
  }

  // Final fallback
  return BRANDING_CONFIGS.default
}

export interface BrandingPromptInput {
  branding?: BrandingSettings | null
  styleKey: KnownClothingStyle
  detailKey: string
}

export interface BrandingPromptResult {
  branding: Record<string, unknown>
  rules: string[]
}

export function generateBrandingPrompt({
  branding,
  styleKey,
  detailKey
}: BrandingPromptInput): BrandingPromptResult {
  if (!branding || branding.type !== 'include' || !branding.logoKey) {
    return {
      branding: {
        enabled: false
      },
      rules: ['No brand marks visible']
    }
  }

  const position = branding.position ?? 'clothing'

  if (position === 'background') {
    // Extract all instructions (logo_source, placement, rules) from BACKGROUND_BRANDING_PROMPT
    const { logo_source, placement, rules: configRules } = BACKGROUND_BRANDING_PROMPT
    const rules: string[] = []
    
    if (typeof logo_source === 'string') {
      rules.push(logo_source)
    }
    
    if (typeof placement === 'string') {
      rules.push(placement)
    }
    
    if (Array.isArray(configRules)) {
      rules.push(...(configRules as string[]))
    }
    
    return {
      branding: {
        enabled: true,
        position: 'background',
        placement: typeof placement === 'string' ? placement : 'on background wall',
        rules // Store rules in the branding object for Step 3
      },
      rules
    }
  }

  if (position === 'elements') {
    // Extract all instructions (logo_source, placement, rules) from ELEMENT_BRANDING_PROMPT
    const { logo_source, placement, rules: configRules, allowed_elements } = ELEMENT_BRANDING_PROMPT
    const rules: string[] = []
    
    if (typeof logo_source === 'string') {
      rules.push(logo_source)
    }
    
    if (typeof placement === 'string') {
      rules.push(placement)
    }
    
    if (Array.isArray(configRules)) {
      rules.push(...(configRules as string[]))
    }
    
    return {
      branding: {
        enabled: true,
        position: 'elements',
        placement: typeof placement === 'string' ? placement : 'on falcon banner flag',
        allowed_elements,
        rules // Store rules in the branding object for Step 3
      },
      rules
    }
  }

  const clothingConfig = resolveClothingBrandingConfig(styleKey, detailKey)
  
  // Build rules array with all instructions
  const rules: string[] = [
    'Use the attached brand image as the logo source.',
    `Place the logo on: ${clothingConfig.placement}.`,
    'The logo size should be modest and proportional to the garment.',
    ...clothingConfig.rules
  ]
  
  return {
    branding: {
      enabled: true,
      position: 'clothing',
      placement: clothingConfig.placement
    },
    rules
  }
}

