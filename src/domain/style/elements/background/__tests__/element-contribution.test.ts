import { BackgroundElement } from '../element'
import type { ElementContext } from '@/domain/style/elements/base/StyleElement'
import type { PhotoStyleSettings } from '@/types/photo-style'

function makeContext(
  phase: ElementContext['phase'],
  styleSettings: PhotoStyleSettings,
): ElementContext {
  return {
    phase,
    settings: styleSettings,
    generationContext: { selfieS3Keys: ['selfies/1.jpg'] },
    existingContributions: [],
  }
}

describe('BackgroundElement.contribute', () => {
  const element = new BackgroundElement()

  it('returns empty for missing background', async () => {
    const result = await element.contribute(
      makeContext('person-generation', {}),
    )
    expect(result.mustFollow).toEqual([])
    expect(result.payload).toEqual({})
  })

  it('returns scene environment for office in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: { mode: 'predefined', value: { type: 'office' } },
      }),
    )
    expect(result.payload).toHaveProperty('scene.environment.location_type')
    expect(result.mustFollow!.length).toBeGreaterThan(0)
  })

  it('returns mustFollow rules for office in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: { mode: 'predefined', value: { type: 'office' } },
      }),
    )
    expect(result.mustFollow!.length).toBeGreaterThan(0)
    expect(result.mustFollow).toContain(
      'Background must be softer/blurrier than the subject for depth',
    )
  })

  it('returns mustFollow rules for neutral in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: {
          mode: 'predefined',
          value: { type: 'neutral', color: '#ffffff' },
        },
      }),
    )
    expect(result.mustFollow).toContain(
      'Background must be smooth and uniform',
    )
  })

  it('returns mustFollow rules for gradient in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: {
          mode: 'predefined',
          value: { type: 'gradient', color: '#667eea' },
        },
      }),
    )
    expect(result.mustFollow).toContain(
      'Gradient must be smooth without banding',
    )
  })

  it('returns custom background worker instructions in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: {
          mode: 'predefined',
          value: { type: 'custom', key: 'bg/custom.jpg' },
        },
      }),
    )
    expect(result.mustFollow).toContain(
      'Use the attached image labeled "background" as the background for the scene',
    )
  })

  it('returns empty contribution for person-generation', async () => {
    const result = await element.contribute(
      makeContext('person-generation', {
        background: {
          mode: 'predefined',
          value: { type: 'custom', key: 'bg/custom.jpg' },
        },
      }),
    )
    expect(result.mustFollow).toEqual([])
    expect(result.payload).toEqual({})
  })

  it('includes location_type for custom in composition', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: {
          mode: 'predefined',
          value: { type: 'custom', key: 'bg/custom.jpg' },
        },
      }),
    )
    const env = (result.payload as Record<string, Record<string, unknown>>)
      ?.scene?.environment as Record<string, unknown> | undefined
    expect(env?.location_type).toBe('custom uploaded background image')
  })

  it('includes color_palette for solid type', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: {
          mode: 'predefined',
          value: { type: 'solid', color: '#ff0000' },
        },
      }),
    )
    const env = (result.payload as Record<string, Record<string, unknown>>)
      ?.scene?.environment as Record<string, unknown>
    expect(env?.color_palette).toEqual(['#ff0000'])
  })

  it('includes metadata with backgroundType', async () => {
    const result = await element.contribute(
      makeContext('composition', {
        background: { mode: 'predefined', value: { type: 'cafe' } },
      }),
    )
    expect(result.metadata).toEqual({ backgroundType: 'cafe' })
  })
})
