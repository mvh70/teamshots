import { deserialize } from '../deserializer'
import { getBackgroundIdentifier } from '../utils'

describe('deserialize', () => {
  it('returns defaults when no background in raw data', () => {
    const result = deserialize({})
    expect(result.mode).toBe('user-choice')
  })

  it('parses new format with predefined mode', () => {
    const result = deserialize({
      background: { mode: 'predefined', value: { type: 'office', prompt: 'Nice office' } },
    })
    expect(result.mode).toBe('predefined')
    expect(result.value?.type).toBe('office')
    expect(result.value?.prompt).toBe('Nice office')
  })

  it('parses new format with user-choice mode', () => {
    const result = deserialize({
      background: { mode: 'user-choice' },
    })
    expect(result.mode).toBe('user-choice')
  })

  it('falls back on invalid mode value', () => {
    const result = deserialize({
      background: { mode: 'invalid-mode', value: { type: 'office' } },
    })
    expect(result.mode).toBe('user-choice')
  })

  it('falls back for predefined mode without value', () => {
    const result = deserialize({
      background: { mode: 'predefined' },
    })
    expect(result.mode).toBe('predefined')
    expect(result.value?.type).toBe('office')
  })

  it('validates value shape through extractBackgroundValue', () => {
    const result = deserialize({
      background: {
        mode: 'predefined',
        value: { type: 'gradient', color: '#abc', unknownField: 'ignored' },
      },
    })
    expect(result.value?.type).toBe('gradient')
    expect(result.value?.color).toBe('#abc')
    expect((result.value as unknown as Record<string, unknown>)?.unknownField).toBeUndefined()
  })

  it('migrates legacy format with type field', () => {
    const result = deserialize({
      background: { type: 'neutral', color: '#808080' },
    })
    expect(result.mode).toBe('predefined')
    expect(result.value?.type).toBe('neutral')
    expect(result.value?.color).toBe('#808080')
  })

  it('handles legacy user-choice type', () => {
    const result = deserialize({
      background: { type: 'user-choice' },
    })
    expect(result.mode).toBe('user-choice')
  })

  it('falls back for unknown object format', () => {
    const result = deserialize({
      background: { randomField: true },
    })
    expect(result.mode).toBe('user-choice')
  })

  it('defaults invalid type to office', () => {
    const result = deserialize({
      background: { type: 'nonexistent-type' },
    })
    expect(result.value?.type).toBe('office')
  })

  it('preserves assetId from legacy format', () => {
    const result = deserialize({
      background: { type: 'custom', assetId: 'asset-123' },
    })
    expect(result.value?.assetId).toBe('asset-123')
  })

  it('preserves modifier from legacy format', () => {
    const result = deserialize({
      background: { type: 'office', modifier: 'bright' },
    })
    expect(result.value?.modifier).toBe('bright')
  })

  it('returns non-object non-null as user-choice with undefined value', () => {
    const result = deserialize({
      background: { mode: 'user-choice', value: 'not-an-object' },
    })
    expect(result.mode).toBe('user-choice')
    expect(result.value).toBeUndefined()
  })
})

describe('getBackgroundIdentifier', () => {
  it('returns undefined for missing background', () => {
    expect(getBackgroundIdentifier(undefined)).toBeUndefined()
  })

  it('returns undefined when no value', () => {
    expect(getBackgroundIdentifier({ mode: 'user-choice' })).toBeUndefined()
  })

  it('prefers assetId over key', () => {
    expect(
      getBackgroundIdentifier({
        mode: 'predefined',
        value: { type: 'custom', key: 's3-key', assetId: 'asset-id' },
      }),
    ).toBe('asset-id')
  })

  it('falls back to key when no assetId', () => {
    expect(
      getBackgroundIdentifier({
        mode: 'predefined',
        value: { type: 'custom', key: 's3-key' },
      }),
    ).toBe('s3-key')
  })

  it('returns undefined when no key or assetId', () => {
    expect(
      getBackgroundIdentifier({
        mode: 'predefined',
        value: { type: 'office' },
      }),
    ).toBeUndefined()
  })
})
