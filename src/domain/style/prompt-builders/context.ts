import { PhotoStyleSettings } from '@/types/photo-style'
import { applyStandardPreset } from '../packages/standard-settings'
import type { StandardPresetConfig } from '../packages/index'
import { createBasePayload } from './payload'
import { getExpressionLabel } from '../elements/expression/config'
import type { PromptBuildContext } from './context-types'

export type PromptPayload = Record<string, unknown>

export type NestedRecord = Record<string, unknown>

const isNestedRecord = (value: unknown): value is NestedRecord =>
  typeof value === 'object' && value !== null

export const setPath = (obj: NestedRecord, path: string, value: unknown): void => {
  const segments = path.split('.')
  let current: NestedRecord = obj
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const next = current[segment]
    if (!isNestedRecord(next)) {
      const child: NestedRecord = {}
      current[segment] = child
      current = child
    } else {
      current = next
    }
  }
  current[segments[segments.length - 1]] = value
}


interface BuildStandardPromptArgs {
  settings: PhotoStyleSettings
  defaultPresetId: string
  presets: Record<string, StandardPresetConfig>
}

export function buildStandardPrompt({
  settings,
  defaultPresetId,
  presets
}: BuildStandardPromptArgs): PromptBuildContext {
  const { settings: effectiveSettings } = applyStandardPreset(
    settings.presetId || defaultPresetId,
    settings,
    presets
  )

  // Use effectiveSettings expression (user's choice) instead of preset defaults
  const expressionLabel = getExpressionLabel(effectiveSettings.expression?.type)
  const payload = createBasePayload({
    preset: presets[settings.presetId || defaultPresetId],
    expressionLabel
  }) as NestedRecord

  setPath(payload, 'meta', {
    preset: presets[settings.presetId || defaultPresetId].label
  })

  return {
    settings: effectiveSettings,
    payload,
    rules: []
  }
}
