import { buildClothingOverlayGenerationPrompt, generateWardrobePrompt } from '../prompt'
import type { ClothingValue } from '../types'

describe('clothing prompt belt guidance', () => {
  const businessFormal: ClothingValue = {
    style: 'business_professional',
    details: 'suit',
  }

  it('adds distinct-color belt guidance when belt is visible and authorized', () => {
    const result = generateWardrobePrompt({
      clothing: businessFormal,
      shotType: 'medium-shot',
    })

    const inherent = result.wardrobe.inherent_accessories as string[] | undefined
    const notes = result.wardrobe.notes as string | undefined

    expect(inherent).toContain('belt')
    expect(notes).toContain('classic leather belt in black or dark brown')
    expect(notes).toContain('distinct from the pants/trousers color')
  })

  it('does not add belt guidance when belt is not visible for shot type', () => {
    const result = generateWardrobePrompt({
      clothing: businessFormal,
      shotType: 'close-up',
    })

    const inherent = result.wardrobe.inherent_accessories as string[] | undefined
    const notes = result.wardrobe.notes as string | undefined

    expect(inherent || []).not.toContain('belt')
    expect(notes || '').not.toContain('distinct from the pants/trousers color')
  })

  it('includes distinct-color belt rule in clothing overlay prompt text', () => {
    const prompt = buildClothingOverlayGenerationPrompt({
      clothing: businessFormal,
      shotType: 'full-length',
    })

    expect(prompt).toContain(
      'Belt: Professional leather belt in a fashionable color clearly distinct from the pants/trousers color'
    )
  })
})
