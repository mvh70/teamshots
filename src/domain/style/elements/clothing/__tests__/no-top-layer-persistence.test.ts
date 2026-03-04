import { normalizeClothingValueWithChoices } from '@/domain/style/elements/clothing/config'
import { normalizeClothingSettings } from '@/domain/style/elements/clothing/deserializer'

describe('clothing no top layer persistence', () => {
  it('preserves explicit no top layer through session JSON roundtrip', () => {
    const value = normalizeClothingValueWithChoices({
      style: 'business_casual',
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: 'trousers',
      outerChoice: '',
      details: 'jacket',
    })

    expect(value.outerChoice).toBe('')

    const roundTripped = JSON.parse(JSON.stringify(value))
    const renormalized = normalizeClothingValueWithChoices(roundTripped)

    expect(renormalized.outerChoice).toBe('')
  })

  it('preserves explicit no top layer when deserializing persisted clothing settings', () => {
    const normalized = normalizeClothingSettings({
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
    })

    expect(normalized.mode).toBe('user-choice')
    expect(normalized.value?.outerChoice).toBe('')
  })
})
