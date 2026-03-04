import { shouldPreferTopLayerForBasePreview } from '@/domain/style/elements/clothing-colors/ClothingColorPreview'

describe('base-layer preview preference', () => {
  it('prefers top-layer image for button-down-like base garments', () => {
    expect(shouldPreferTopLayerForBasePreview('t-shirt', false)).toBe(true)
    expect(shouldPreferTopLayerForBasePreview('button-down', false)).toBe(true)
    expect(shouldPreferTopLayerForBasePreview('polo', false)).toBe(true)
    expect(shouldPreferTopLayerForBasePreview('blouse', false)).toBe(true)
    expect(shouldPreferTopLayerForBasePreview('hoodie', false)).toBe(true)
    expect(shouldPreferTopLayerForBasePreview('silk-blouse', false)).toBe(true)
  })

  it('does not prefer top-layer image for unsupported base choices', () => {
    expect(shouldPreferTopLayerForBasePreview('dress-shirt', false)).toBe(false)
    expect(shouldPreferTopLayerForBasePreview(undefined, false)).toBe(false)
  })

  it('does not prefer top-layer image when an outer layer is selected', () => {
    expect(shouldPreferTopLayerForBasePreview('t-shirt', true)).toBe(false)
    expect(shouldPreferTopLayerForBasePreview('button-down', true)).toBe(false)
  })
})
