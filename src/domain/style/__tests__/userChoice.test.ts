import {
  getEditableCategories,
  getUneditedEditableFieldNames,
  hasUneditedEditableFields
} from '../userChoice'

// Mock the packages module
jest.mock('../packages', () => ({
  getPackageConfig: jest.fn((packageId: string) => {
    if (packageId === 'headshot1') {
      return {
        id: 'headshot1',
        visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'pose', 'expression'],
        userStyleCategories: ['clothing', 'clothingColors', 'expression'],
        defaultSettings: {
          background: { mode: 'predefined', value: { type: 'office' } },
          branding: { mode: 'predefined', value: {} },
          clothing: { style: 'user-choice' },
          clothingColors: { mode: 'user-choice' },
          pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
          expression: { mode: 'user-choice' }
        }
      }
    }
    if (packageId === 'freepackage') {
      return {
        id: 'freepackage',
        visibleCategories: ['background', 'clothing', 'clothingColors', 'pose', 'expression'],
        userStyleCategories: ['clothing', 'clothingColors', 'expression'],
        defaultSettings: {
          background: { mode: 'predefined', value: { type: 'office' } },
          clothing: { style: 'user-choice' },
          clothingColors: { mode: 'user-choice' },
          pose: { mode: 'predefined', value: { type: 'classic_corporate' } },
          expression: { mode: 'user-choice' }
        }
      }
    }
    return {
      id: packageId,
      visibleCategories: [],
      userStyleCategories: [],
      defaultSettings: {}
    }
  })
}))

describe('getEditableCategories', () => {
  it('returns userStyleCategories when no originalSettings provided', () => {
    const result = getEditableCategories(undefined, 'headshot1')

    expect(result).toContain('clothing')
    expect(result).toContain('clothingColors')
    expect(result).toContain('expression')
    expect(result.size).toBe(3)
  })

  it('returns categories marked as user-choice in originalSettings', () => {
    const originalSettings = {
      background: { mode: 'user-choice' },
      clothing: { style: 'predefined', value: 'business' },
      pose: { mode: 'user-choice' },
      expression: { mode: 'predefined', value: { type: 'smile' } }
    }

    const result = getEditableCategories(originalSettings, 'headshot1')

    expect(result).toContain('background')
    expect(result).toContain('pose')
    expect(result).not.toContain('clothing')
    expect(result).not.toContain('expression')
  })

  it('handles legacy format (type instead of mode)', () => {
    const originalSettings = {
      pose: { type: 'user-choice' },
      expression: { type: 'genuine_smile' } // not user-choice
    }

    const result = getEditableCategories(originalSettings, 'headshot1')

    expect(result).toContain('pose')
    expect(result).not.toContain('expression')
  })

  it('falls back to userStyleCategories when originalSettings has no user-choice fields', () => {
    const originalSettings = {
      background: { mode: 'predefined', value: { type: 'office' } },
      pose: { mode: 'predefined', value: { type: 'classic' } }
    }

    const result = getEditableCategories(originalSettings, 'headshot1')

    // Should fall back to userStyleCategories
    expect(result).toContain('clothing')
    expect(result).toContain('clothingColors')
    expect(result).toContain('expression')
  })
})

describe('getUneditedEditableFieldNames', () => {
  it('returns editable fields that have not been changed', () => {
    const current = {
      clothing: { style: 'user-choice' },
      clothingColors: { mode: 'user-choice' },
      expression: { mode: 'user-choice' }
    }
    const original = {
      clothing: { style: 'user-choice' },
      clothingColors: { mode: 'user-choice' },
      expression: { mode: 'user-choice' }
    }

    const result = getUneditedEditableFieldNames(current, original, 'headshot1')

    expect(result).toContain('clothing')
    expect(result).toContain('expression')
  })

  it('excludes fields that have been edited', () => {
    const current = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice', value: { type: 'genuine_smile' } } // user selected a value
    }
    const original = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice' } // no value originally
    }

    const result = getUneditedEditableFieldNames(current, original, 'headshot1')

    expect(result).toContain('clothing')
    expect(result).not.toContain('expression')
  })

  it('uses package defaults when original is undefined', () => {
    const current = {
      clothing: { style: 'user-choice' },
      clothingColors: { mode: 'user-choice' },
      expression: { mode: 'user-choice' }
    }

    const result = getUneditedEditableFieldNames(current, undefined, 'headshot1')

    // Should still identify editable fields from package userStyleCategories
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles clothingColors with resolved colors', () => {
    const current = {
      clothingColors: {
        mode: 'user-choice',
        value: { topLayer: 'blue' } // has a color set
      }
    }
    const original = {
      clothingColors: { mode: 'user-choice' }
    }

    const result = getUneditedEditableFieldNames(current, original, 'headshot1')

    // clothingColors should not be in unedited because it has colors
    expect(result).not.toContain('clothingColors')
  })

  it('returns fields in visibleCategories order', () => {
    const current = {
      expression: { mode: 'user-choice' },
      clothing: { style: 'user-choice' },
      clothingColors: { mode: 'user-choice' }
    }
    const original = {
      expression: { mode: 'user-choice' },
      clothing: { style: 'user-choice' },
      clothingColors: { mode: 'user-choice' }
    }

    const result = getUneditedEditableFieldNames(current, original, 'headshot1')

    // Order should match visibleCategories: clothing comes before expression
    const clothingIndex = result.indexOf('clothing')
    const expressionIndex = result.indexOf('expression')

    if (clothingIndex !== -1 && expressionIndex !== -1) {
      expect(clothingIndex).toBeLessThan(expressionIndex)
    }
  })
})

describe('hasUneditedEditableFields', () => {
  it('returns true when there are unedited editable fields', () => {
    const current = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice' }
    }
    const original = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice' }
    }

    const result = hasUneditedEditableFields(current, original, 'headshot1')

    expect(result).toBe(true)
  })

  it('returns false when all editable fields have been edited', () => {
    const current = {
      clothing: { style: 'predefined', value: 'business' },
      expression: { mode: 'user-choice', value: { type: 'genuine_smile' } }
    }
    const original = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice' }
    }

    const result = hasUneditedEditableFields(current, original, 'headshot1')

    expect(result).toBe(false)
  })

  it('handles undefined original settings', () => {
    const current = {
      clothing: { style: 'user-choice' },
      expression: { mode: 'user-choice' }
    }

    const result = hasUneditedEditableFields(current, undefined, 'headshot1')

    // Should still work using package defaults
    expect(typeof result).toBe('boolean')
  })
})
