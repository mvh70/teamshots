import { resolveExcludedClothingColors } from '../layer-visibility'

describe('resolveExcludedClothingColors', () => {
  it('merges shot-type and wardrobe exclusions', () => {
    const exclusions = resolveExcludedClothingColors({
      shotType: 'close-up',
      clothingStyle: 'business_professional',
      clothingDetail: 'dress',
    })

    expect(exclusions).toEqual(
      expect.arrayContaining(['baseLayer', 'bottom', 'shoes'])
    )
    expect(new Set(exclusions).size).toBe(exclusions.length)
  })

  it('returns only wardrobe exclusions when shot type is missing', () => {
    const exclusions = resolveExcludedClothingColors({
      clothingStyle: 'startup',
      clothingDetail: 'hoodie',
    })

    expect(exclusions).toEqual(['baseLayer'])
  })

  it('returns only shot exclusions when clothing is missing', () => {
    const exclusions = resolveExcludedClothingColors({
      shotType: 'medium-close-up',
    })

    expect(exclusions).toEqual(['shoes'])
  })

  it('hides topLayer color when no top layer is selected in separate mode', () => {
    const exclusions = resolveExcludedClothingColors({
      clothingStyle: 'business_casual',
      clothingDetail: 'jacket',
      clothingValue: {
        mode: 'separate',
        topChoice: 'polo',
        bottomChoice: 'trousers',
        outerChoice: undefined,
      },
    })

    expect(exclusions).toContain('topLayer')
  })

  it('hides base and bottom layer colors for one-piece mode', () => {
    const exclusions = resolveExcludedClothingColors({
      clothingStyle: 'black-tie',
      clothingDetail: 'gown',
      clothingValue: {
        mode: 'one_piece',
        onePieceChoice: 'gown',
      },
    })

    expect(exclusions).toEqual(expect.arrayContaining(['baseLayer', 'bottom']))
  })
})
