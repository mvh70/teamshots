import type { StandardPresetConfig } from '../packages/index'

import { subject } from './subject'

export type PromptPayload = Record<string, unknown>

interface CreateBasePayloadOptions {
  preset: StandardPresetConfig
  expressionLabel: string
}

export function createBasePayload({
  preset,
  expressionLabel
}: CreateBasePayloadOptions): PromptPayload {
  const defaults = preset.defaults
  const orientation =
    defaults.orientation === 'either' ? 'vertical' : defaults.orientation ?? 'vertical'
  const headroomPercent = defaults.composition.headroomPercent ?? 12
  const framingNote = defaults.composition.framingNotes?.[0] ?? 'centered'
  const backgroundDistance = defaults.environment.distanceFromSubjectFt ?? 6
  const environmentNotes = defaults.environment.notes ?? []

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
        chin_technique: '', // Will be filled by specific pose templates or prompt builder logic
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
        type: 'prime'
        // focal_length_mm and character are set by camera-settings element
      },
      settings: {
        shutter_speed: defaults.shutterSpeed ?? '1/200',
        focus: 'eye-AF'
        // aperture, iso set by camera-settings element
      }
      // positioning and color set by camera-settings element
    },
    lighting: {
      // All lighting properties set by lighting element
    },
    rendering: { ...subject.rendering }
  }
}

