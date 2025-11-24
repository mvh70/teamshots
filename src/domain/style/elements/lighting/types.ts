export interface LightingInput {
  backgroundEnvironment: 'studio' | 'outdoor' | 'indoor'
  backgroundModifier?: string
  timeOfDay?: string
  shotType: string
  presetId?: string
  subjectCount: number
}

export interface LightingSettings {
  quality: string
  direction: string
  setup: string[]
  colorTemp: number
  description: string
}

