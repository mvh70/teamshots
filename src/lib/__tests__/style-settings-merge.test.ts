import type { PhotoStyleSettings } from '@/types/photo-style'
import { mergeSavedUserChoiceStyleSettings } from '@/lib/style-settings-merge'

describe('mergeSavedUserChoiceStyleSettings', () => {
  it('does not inject missing pose/expression when keys are absent from current settings', () => {
    const settings = {
      background: { mode: 'user-choice', value: { type: 'office' } },
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'classic_corporate' },
      expression: { type: 'genuine_smile' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
    })

    expect(Object.prototype.hasOwnProperty.call(merged, 'pose')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(merged, 'expression')).toBe(false)
    expect(merged.background).toEqual(settings.background)
  })

  it('can restore missing pose when key exists on current settings object', () => {
    const settings = {
      pose: undefined,
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'classic_corporate' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
    })

    expect(merged.pose).toEqual({
      mode: 'user-choice',
      value: { type: 'classic_corporate' },
    })
  })

  it('continues to merge into existing user-choice pose/expression fields', () => {
    const settings = {
      pose: { mode: 'user-choice', value: undefined },
      expression: { mode: 'user-choice', value: undefined },
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'power_cross' },
      expression: { type: 'soft_smile' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
    })

    expect(merged.pose).toEqual({
      mode: 'user-choice',
      value: { type: 'power_cross' },
    })
    expect(merged.expression).toEqual({
      mode: 'user-choice',
      value: { type: 'soft_smile' },
    })
  })

  it('does not overwrite predefined settings', () => {
    const settings = {
      pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'power_cross' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
    })

    expect(merged.pose).toEqual(settings.pose)
  })
})
