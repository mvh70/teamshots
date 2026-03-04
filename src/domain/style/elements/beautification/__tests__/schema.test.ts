import { normalizeBeautificationValue } from '../schema'

describe('beautification schema normalization', () => {
  it('maps legacy max retouching to high', () => {
    const normalized = normalizeBeautificationValue({ retouching: 'max' })
    expect(normalized.retouching).toBe('high')
  })

  it('keeps high retouching as high', () => {
    const normalized = normalizeBeautificationValue({ retouching: 'high' })
    expect(normalized.retouching).toBe('high')
  })
})
