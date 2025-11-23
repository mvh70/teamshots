import type { StandardPresetConfig } from '../packages/standard-presets'
import { CHIN_TECHNIQUE_NOTE } from '../elements/pose/config'

import { subject } from './subject'

export type PromptPayload = Record<string, unknown>

interface CreateBasePayloadOptions {
  preset: StandardPresetConfig
  expressionLabel: string
  lightingDirectionLabel: string
}

export function createBasePayload({
  preset,
  expressionLabel,
  lightingDirectionLabel
}: CreateBasePayloadOptions): PromptPayload {
  const defaults = preset.defaults
  const orientation =
    defaults.orientation === 'either' ? 'vertical' : defaults.orientation ?? 'vertical'
  const headroomPercent = defaults.composition.headroomPercent ?? 12
  const framingNote = defaults.composition.framingNotes?.[0] ?? 'centered'
  const backgroundDistance = defaults.environment.distanceFromSubjectFt ?? 6
  const environmentNotes = defaults.environment.notes ?? []
  const lightingSetup =
    defaults.lighting.setupNotes ?? ['Softbox (3x4ft or larger) + reflector opposite']
  const colorTemperature = defaults.lighting.colorTempKelvin
    ? `${defaults.lighting.colorTempKelvin}K`
    : '5500K'

  return {
    scene: {
      environment: {
        location_type: defaults.environment.description,
        distance_from_background_ft: backgroundDistance,
        notes: environmentNotes
      }
    },
    subject: {
      identity: { ...subject.identity },
      pose: {
        body_angle: '',
        head_position: '',
        chin_technique: CHIN_TECHNIQUE_NOTE,
        shoulder_position: '',
        weight_distribution: '',
        arms: '',
        sitting_position: undefined,
        expression: expressionLabel
      },
      wardrobe: {},
      branding: {}
    },
    framing: {
      shot_type: '',
      crop_points: '',
      orientation,
      composition: framingNote,
      headroom_percent: headroomPercent
    },
    camera: {
      sensor: 'full-frame mirrorless',
      lens: {
        focal_length_mm: 85,
        type: 'prime',
        character: 'Portrait standard focal length with flattering compression and separation.'
      },
      settings: {
        aperture: defaults.aperture ?? 'f/4.0',
        shutter_speed: defaults.shutterSpeed ?? '1/200',
        iso: defaults.iso ?? 100,
        white_balance: colorTemperature,
        focus: 'eye-AF'
      }
    },
    lighting: {
      quality: 'Soft Diffused',
      direction: lightingDirectionLabel,
      setup: lightingSetup,
      color_temperature: colorTemperature,
      description: 'Flattering professional lighting with gentle transitions and minimal harsh shadows.'
    },
    rendering: { ...subject.rendering }
  }
}

