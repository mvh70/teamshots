import type { BrandingSettings } from '@/types/photo-style'
import { KnownClothingStyle } from '../clothing/config'
import { BACKGROUND_BRANDING_PROMPT, ELEMENT_BRANDING_PROMPT, resolveClothingBrandingConfig } from './config'

export interface BrandingPromptInput {
  branding?: BrandingSettings | null
  styleKey: KnownClothingStyle
  detailKey: string
  defaultPose: {
    description: string
    arms: string
  }
}

export interface BrandingPromptResult {
  branding: Record<string, unknown>
  pose: {
    description: string
    arms: string
  }
}

export function generateBrandingPrompt({
  branding,
  styleKey,
  detailKey,
  defaultPose
}: BrandingPromptInput): BrandingPromptResult {
  if (!branding || branding.type !== 'include' || !branding.logoKey) {
    return {
      branding: {
        rules: ['no brand marks visible']
      },
      pose: defaultPose
    }
  }

  const position = branding.position ?? 'clothing'

  if (position === 'background') {
    return {
      branding: BACKGROUND_BRANDING_PROMPT,
      pose: defaultPose
    }
  }

  if (position === 'elements') {
    return {
      branding: ELEMENT_BRANDING_PROMPT,
      pose: defaultPose
    }
  }

  const clothingConfig = resolveClothingBrandingConfig(styleKey, detailKey)
  return {
    branding: {
      logo_source: 'attached brand image',
      placement: clothingConfig.placement,
      size: 'modest, proportional to garment',
      rules: clothingConfig.rules
    },
    pose: clothingConfig.pose
  }
}

