export type CameraHeight = 'eye_level' | 'chest_level' | 'waist_level' | 'slightly_above_eye' | 'slightly_below_eye'

export interface CameraSettings {
  focalLength: number
  aperture: number
  iso: number
  whiteBalance: number
  cameraDistance: number // feet
  backgroundDistance: number // feet
  cameraHeight: CameraHeight
}

export interface CameraSettingsInput {
  shotType: string
  backgroundEnvironment: 'studio' | 'outdoor' | 'indoor'
  backgroundModifier?: string
  subjectCount: number
  timeOfDay?: string
  platform?: string
  presetId?: string
}

