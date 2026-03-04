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

  it('does not overwrite predefined settings for elements without predefined merge support', () => {
    const settings = {
      expression: { mode: 'predefined', value: { type: 'soft_smile' } },
    } as PhotoStyleSettings

    const saved = {
      expression: { type: 'genuine_smile' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
    })

    expect(merged.expression).toEqual(settings.expression)
  })

  it('restores predefined pose from session when element allows predefined merge', () => {
    const settings = {
      pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
    } as PhotoStyleSettings

    const saved = {
      pose: { mode: 'predefined', value: { type: 'power_cross' } },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['pose'],
    })

    expect(merged.pose).toEqual({
      mode: 'predefined',
      value: { type: 'power_cross' },
    })
  })

  it('restores predefined clothing colors from session when element allows predefined merge', () => {
    const settings = {
      clothingColors: {
        mode: 'predefined',
        value: {
          topLayer: '#112233',
          baseLayer: '#445566',
        },
      },
    } as PhotoStyleSettings

    const saved = {
      clothingColors: {
        mode: 'predefined',
        value: {
          topLayer: '#abcdef',
          bottom: '#123123',
          source: 'manual',
        },
      },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['clothingColors'],
    })

    expect(merged.clothingColors).toEqual({
      mode: 'predefined',
      value: {
        topLayer: '#abcdef',
        bottom: '#123123',
        source: 'manual',
      },
    })
  })

  it('skips categories not in visibleCategories when provided', () => {
    const settings = {
      pose: { mode: 'user-choice', value: undefined },
      expression: { mode: 'user-choice', value: undefined },
      background: { mode: 'user-choice', value: undefined },
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'power_cross' },
      expression: { type: 'genuine_smile' },
      background: { mode: 'user-choice', value: { type: 'office' } },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['background', 'pose'],
    })

    // pose and background are visible — should be merged
    expect(merged.pose).toEqual({
      mode: 'user-choice',
      value: { type: 'power_cross' },
    })
    expect(merged.background).toEqual({
      mode: 'user-choice',
      value: { type: 'office' },
    })
    // expression is NOT visible — should remain unchanged
    expect(merged.expression).toEqual({ mode: 'user-choice', value: undefined })
  })

  it('always merges beautification even when not in visibleCategories', () => {
    const settings = {
      beautification: { mode: 'user-choice', value: undefined },
    } as PhotoStyleSettings

    const saved = {
      beautification: { mode: 'user-choice', value: { retouching: 'light' } },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['background'], // beautification not listed
    })

    // beautification is in NON_VISIBLE_OVERRIDABLE_SETTING_FIELDS — always merged
    expect(merged.beautification).toEqual({
      mode: 'user-choice',
      value: { retouching: 'light' },
    })
  })

  it('injects beautification from session even when key missing from settings (legacy context)', () => {
    // Simulates a context created before beautification existed — no beautification key at all
    const settings = {
      background: { mode: 'user-choice', value: { type: 'office' } },
    } as PhotoStyleSettings

    const saved = {
      beautification: {
        mode: 'user-choice',
        value: {
          retouching: 'light',
          accessories: { glasses: { action: 'remove' } },
        },
      },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['background'],
    })

    // beautification should be injected even though settings didn't have the key
    expect(merged.beautification).toEqual({
      mode: 'user-choice',
      value: {
        retouching: 'light',
        accessories: { glasses: { action: 'remove' } },
      },
    })
  })

  it('still does not inject non-overridable fields when key is missing', () => {
    const settings = {
      background: { mode: 'user-choice', value: { type: 'office' } },
    } as PhotoStyleSettings

    const saved = {
      pose: { type: 'classic_corporate' },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['background'],
    })

    // pose is NOT a non-visible overridable field, so it should NOT be injected
    expect(Object.prototype.hasOwnProperty.call(merged, 'pose')).toBe(false)
  })

  it('restores style-only clothing sub-choices for predefined styles', () => {
    const settings = {
      clothing: {
        mode: 'predefined',
        value: {
          style: 'business_casual',
          mode: 'separate',
          topChoice: 'button-down',
          bottomChoice: 'trousers',
          outerChoice: 'jacket',
          details: 'jacket',
          lockScope: 'style-only',
        },
      },
    } as unknown as PhotoStyleSettings

    const saved = {
      clothing: {
        mode: 'user-choice',
        value: {
          style: 'business_casual',
          mode: 'one_piece',
          onePieceChoice: 'dress',
          details: 'dress',
        },
      },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['clothing'],
    })

    expect(merged.clothing).toEqual({
      mode: 'predefined',
      value: {
        style: 'business_casual',
        mode: 'one_piece',
        onePieceChoice: 'dress',
        details: 'dress',
        topChoice: undefined,
        bottomChoice: undefined,
        outerChoice: undefined,
        lockScope: 'style-only',
      },
    })
  })

  it('does not restore style-only clothing values when saved style differs', () => {
    const settings = {
      clothing: {
        mode: 'predefined',
        value: {
          style: 'business_professional',
          mode: 'separate',
          topChoice: 'dress-shirt',
          bottomChoice: 'trousers',
          outerChoice: 'suit-jacket',
          details: 'suit',
          lockScope: 'style-only',
        },
      },
    } as unknown as PhotoStyleSettings

    const saved = {
      clothing: {
        mode: 'user-choice',
        value: {
          style: 'startup',
          mode: 'separate',
          topChoice: 'hoodie',
          bottomChoice: 'jeans',
        },
      },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['clothing'],
    })

    expect(merged.clothing).toEqual(settings.clothing)
  })

  it('merges user-choice elements not hardcoded in previous merge lists', () => {
    const settings = {
      industry: { mode: 'user-choice', value: undefined },
    } as unknown as PhotoStyleSettings

    const saved = {
      industry: { mode: 'user-choice', value: { type: 'medical' } },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['industry'],
    })

    expect(merged.industry).toEqual({ mode: 'user-choice', value: { type: 'medical' } })
  })

  it('keeps explicit no top layer marker for user-choice clothing', () => {
    const settings = {
      clothing: { mode: 'user-choice', value: undefined },
    } as unknown as PhotoStyleSettings

    const saved = {
      clothing: {
        mode: 'user-choice',
        value: {
          style: 'business_casual',
          mode: 'separate',
          topChoice: 't-shirt',
          bottomChoice: 'trousers',
          outerChoice: '',
          details: 'jacket',
        },
      },
    } as unknown as Partial<PhotoStyleSettings>

    const merged = mergeSavedUserChoiceStyleSettings({
      settings,
      savedSettings: saved,
      visibleCategories: ['clothing'],
    })

    expect(merged.clothing?.value?.outerChoice).toBe('')
  })
})
