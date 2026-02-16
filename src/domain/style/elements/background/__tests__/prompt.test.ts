import { generateBackgroundPrompt } from '../prompt'
import type { BackgroundValue } from '../types'

describe('generateBackgroundPrompt', () => {
  it('returns location_type for office', () => {
    const result = generateBackgroundPrompt({ type: 'office' })
    expect(result.location_type).toContain('office')
  })

  it('includes description for office with prompt', () => {
    const result = generateBackgroundPrompt({ type: 'office', prompt: 'Corner office' })
    expect(result.description).toBe('Corner office')
  })

  it('returns location_type for tropical-beach', () => {
    const result = generateBackgroundPrompt({ type: 'tropical-beach' })
    expect(result.location_type).toContain('tropical')
  })

  it('returns location_type for busy-city', () => {
    const result = generateBackgroundPrompt({ type: 'busy-city' })
    expect(result.location_type).toContain('city')
  })

  it('returns color_palette for neutral with color', () => {
    const result = generateBackgroundPrompt({ type: 'neutral', color: '#808080' })
    expect(result.color_palette).toEqual(['#808080'])
  })

  it('returns no color_palette for neutral without color', () => {
    const result = generateBackgroundPrompt({ type: 'neutral' })
    expect(result.color_palette).toBeUndefined()
  })

  it('returns color_palette for gradient with color', () => {
    const result = generateBackgroundPrompt({ type: 'gradient', color: '#667eea' })
    expect(result.color_palette).toEqual(['#667eea'])
  })

  it('returns domain description for custom', () => {
    const result = generateBackgroundPrompt({ type: 'custom', key: 'bg.jpg' })
    expect(result.location_type).toBe('custom uploaded background image')
  })

  it('returns location_type for cafe', () => {
    const result = generateBackgroundPrompt({ type: 'cafe' })
    expect(result.location_type).toContain('cafe')
  })

  it('returns location_type for outdoor', () => {
    const result = generateBackgroundPrompt({ type: 'outdoor' })
    expect(result.location_type).toContain('outdoor')
  })

  it('returns color_palette for solid with color', () => {
    const result = generateBackgroundPrompt({ type: 'solid', color: '#ff0000' })
    expect(result.color_palette).toEqual(['#ff0000'])
  })

  it('returns location_type for urban', () => {
    const result = generateBackgroundPrompt({ type: 'urban' })
    expect(result.location_type).toContain('urban')
  })

  it('returns location_type for stage', () => {
    const result = generateBackgroundPrompt({ type: 'stage' })
    expect(result.location_type).toContain('stage')
  })

  it('returns color_palette for dark_studio with color', () => {
    const result = generateBackgroundPrompt({ type: 'dark_studio', color: '#1a1a2e' })
    expect(result.color_palette).toEqual(['#1a1a2e'])
  })

  it('returns color_palette for team_bright with color', () => {
    const result = generateBackgroundPrompt({ type: 'team_bright', color: '#f0f0f0' })
    expect(result.color_palette).toEqual(['#f0f0f0'])
  })

  it('returns location_type for lifestyle', () => {
    const result = generateBackgroundPrompt({ type: 'lifestyle' })
    expect(result.location_type).toContain('natural')
  })

  it('returns empty object for unknown type', () => {
    const result = generateBackgroundPrompt({ type: 'nonexistent' as BackgroundValue['type'] })
    expect(result).toEqual({})
  })
})
