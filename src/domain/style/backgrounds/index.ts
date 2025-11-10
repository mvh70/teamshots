// Central background repository
// This defines all available backgrounds and their prompt generation logic
import { BackgroundSettings } from '@/types/photo-style'

export interface BackgroundDefinition {
  id: string
  label: string
  requiresColor?: boolean // If true, package should include a color picker
  generatePrompt: (settings: Partial<BackgroundSettings>) => {
    location_type?: string
    color_palette?: string[]
    description?: string
    branding?: string
  }
}

// Base background definitions
const OFFICE_BG: BackgroundDefinition = {
  id: 'office',
  label: 'Office Environment',
  generatePrompt: (settings) => ({
    location_type: 'a corporate office environment, the background should be fuzzy, so that the subject is central in the image and the background is blurred out.',
    description: settings.prompt
  })
}

const TROPICAL_BEACH_BG: BackgroundDefinition = {
  id: 'tropical-beach',
  label: 'Tropical Beach',
  generatePrompt: () => ({
    location_type: 'a tropical beach setting with palm trees and ocean in the background, soft and atmospheric'
  })
}

const BUSY_CITY_BG: BackgroundDefinition = {
  id: 'busy-city',
  label: 'Busy City',
  generatePrompt: () => ({
    location_type: 'a busy urban city street with buildings and people in the background, blurred for depth'
  })
}

const NEUTRAL_BG: BackgroundDefinition = {
  id: 'neutral',
  label: 'Neutral Background',
  requiresColor: true,
  generatePrompt: (settings) => ({
    location_type: 'a studio with a neutral background',
    color_palette: settings.color ? [settings.color] : undefined
  })
}

const GRADIENT_BG: BackgroundDefinition = {
  id: 'gradient',
  label: 'Gradient Background',
  requiresColor: true,
  generatePrompt: (settings) => ({
    location_type: 'a studio with a gradient background going from light to dark',
    color_palette: settings.color ? [settings.color] : undefined
  })
}

const CUSTOM_BG: BackgroundDefinition = {
  id: 'custom',
  label: 'Custom Background',
  generatePrompt: () => ({
    location_type: 'Use the attached image labeled "background" as the background for the scene. The subject should be placed in the foreground. Adhere strictly to the requested framing and composition for the final image.'
  })
}

// Repository of all backgrounds
export const BACKGROUND_REPOSITORY: Record<string, BackgroundDefinition> = {
  [OFFICE_BG.id]: OFFICE_BG,
  [TROPICAL_BEACH_BG.id]: TROPICAL_BEACH_BG,
  [BUSY_CITY_BG.id]: BUSY_CITY_BG,
  [NEUTRAL_BG.id]: NEUTRAL_BG,
  [GRADIENT_BG.id]: GRADIENT_BG,
  [CUSTOM_BG.id]: CUSTOM_BG
}

// Helper to get background definition by ID
export function getBackgroundDefinition(id: string): BackgroundDefinition | undefined {
  return BACKGROUND_REPOSITORY[id]
}

// Helper to check if background requires a color picker
export function backgroundRequiresColor(id: string): boolean {
  return BACKGROUND_REPOSITORY[id]?.requiresColor ?? false
}

// Helper to generate prompt for a background
export function generateBackgroundPrompt(settings: BackgroundSettings): {
  location_type?: string
  color_palette?: string[]
  description?: string
  branding?: string
} {
  const definition = getBackgroundDefinition(settings.type)
  if (!definition) {
    return {}
  }
  return definition.generatePrompt(settings)
}

