import { generateBeautificationPrompt } from '../prompt'

describe('generateBeautificationPrompt', () => {
  it('keeps natural texture when retouching is none', () => {
    const result = generateBeautificationPrompt({
      retouching: 'none',
    })

    expect(result.mustFollow).toContain(
      'Do not apply beautification. Keep natural skin texture, pores, fine lines, temporary blemishes, under-eye details, and flyaway hairs exactly as in BASE IMAGE (step1a). Use selfies for identity verification only.'
    )
    expect(result.mustFollow).toContain(
      'Do not perform skin smoothing, dark-circle reduction, blemish cleanup, tone-evening, or teeth/eye whitening.'
    )
    expect(result.retouchingMustFollow).toEqual(
      expect.arrayContaining([
        'Do not perform skin smoothing, dark-circle reduction, blemish cleanup, tone-evening, or teeth/eye whitening.',
      ])
    )
    expect(result.accessoryMustFollow).toEqual([])
    expect(result.payload.subject).toEqual(
      expect.objectContaining({
        beautification: expect.objectContaining({
          retouching: expect.objectContaining({ level: 'none' }),
        }),
      })
    )
    expect(result.metadata.fixes).toEqual([])
  })

  it('applies strongest polish guidance when retouching is high', () => {
    const result = generateBeautificationPrompt({
      retouching: 'high',
    })

    expect(result.mustFollow.join(' ')).toContain('Apply high retouching for a polished corporate portrait')
    expect(result.metadata.retouching).toBe('high')
    expect(result.metadata.fixes).toEqual(
      expect.arrayContaining([
        'strong_dark_circle_reduction',
        'enhanced_skin_smoothing_with_texture_preserved',
      ])
    )
  })

  it('adds remove instructions for configured accessories', () => {
    const result = generateBeautificationPrompt({
      retouching: 'light',
      accessories: {
        glasses: { action: 'remove' },
        facialHair: { action: 'remove' },
      },
    })

    expect(result.mustFollow).toContain(
      'Remove glasses if present while preserving natural anatomy and realism.'
    )
    expect(result.accessoryMustFollow).toContain(
      'Remove glasses if present while preserving natural anatomy and realism.'
    )
    expect(result.mustFollow).toContain(
      'Remove facial hair if present while preserving natural anatomy and realism. The skin where facial hair was removed must be clean and smooth with no stubble, shadow, or added skin imperfections.'
    )
    expect(result.retouchingMustFollow.join(' ')).toContain('Apply light retouching only with minimal edits')
  })
})
