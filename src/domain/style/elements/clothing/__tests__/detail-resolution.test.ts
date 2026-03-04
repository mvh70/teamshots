import { getEffectiveClothingDetail, normalizeClothingValueWithChoices } from '@/domain/style/elements/clothing/config'

describe('clothing detail resolution', () => {
  it('prefers one-piece choice over stale explicit detail', () => {
    const detail = getEffectiveClothingDetail('black-tie', {
      mode: 'one_piece',
      onePieceChoice: 'gown',
      details: 'suit',
    })

    expect(detail).toBe('gown')
  })

  it('normalization rewrites stale detail when one-piece choice is selected', () => {
    const normalized = normalizeClothingValueWithChoices({
      style: 'black-tie',
      mode: 'one_piece',
      onePieceChoice: 'gown',
      details: 'suit',
      topChoice: 'dress-shirt',
      bottomChoice: 'dress-pants',
      outerChoice: 'suit-jacket',
    })

    expect(normalized.mode).toBe('one_piece')
    expect(normalized.onePieceChoice).toBe('gown')
    expect(normalized.topChoice).toBeUndefined()
    expect(normalized.bottomChoice).toBeUndefined()
    expect(normalized.outerChoice).toBeUndefined()
    expect(normalized.details).toBe('gown')
  })

  it('ignores stale one-piece detail for separate mode and resolves from layer choices', () => {
    const detail = getEffectiveClothingDetail('startup', {
      mode: 'separate',
      topChoice: 'hoodie',
      bottomChoice: 'jeans',
      details: 'gown',
    })

    expect(detail).toBe('hoodie')
  })
})
