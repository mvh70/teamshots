import { PhotoStyleSettings } from '@/types/photo-style'
import {
  resolveShotType,
  resolveFocalLength,
  resolveAperture,
  resolveLightingQuality,
  resolveShutterSpeed
} from './config'

export interface ShotTypePromptResult {
  framing: {
    shot_type: string
    crop_points: string
    composition: string
  }
  camera: {
    lens: {
      focal_length_mm: number
      type: string
      character: string
    }
    settings: {
      aperture: string
      shutter_speed: string
    }
  }
  lighting: {
    quality: string
    description: string
  }
}

export function generateShotTypePrompt(settings: PhotoStyleSettings): ShotTypePromptResult {
  const shotType = resolveShotType(settings.shotType?.type)
  const focalLength = resolveFocalLength(settings.focalLength as string | undefined)
  const aperture = resolveAperture(settings.aperture as string | undefined)
  const lighting = resolveLightingQuality(settings.lightingQuality as string | undefined)
  const shutter = resolveShutterSpeed(settings.shutterSpeed as string | undefined)

  return {
    framing: {
      shot_type: shotType.label,
      crop_points: shotType.framingDescription,
      composition: shotType.compositionNotes ?? shotType.framingDescription
    },
    camera: {
      lens: {
        focal_length_mm: focalLength.mm,
        type: focalLength.lensType,
        character: focalLength.description
      },
      settings: {
        aperture: aperture.value,
        shutter_speed: shutter.value
      }
    },
    lighting: {
      quality: lighting.label,
      description: lighting.description
    }
  }
}

