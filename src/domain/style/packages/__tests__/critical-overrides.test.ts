import { describe, expect, it } from 'vitest'
import { computeCriticalOverrides } from '../critical-overrides'

describe('computeCriticalOverrides', () => {
  it('enforces headshot guidelines for single subject', () => {
    const result = computeCriticalOverrides({
      presetId: 'corporate-headshot',
      shotType: 'medium-close-up',
      subjectCount: '1',
      usageContext: 'general',
      baseBackgroundDistanceFt: 5
    })

    expect(result.focalLength?.mm).toBe(85)
    expect(result.aperture?.value).toBe('f/4.0')
    expect(result.subjectScalePercent).toBe(80)
    expect(result.headroomPercent).toBe(10)
    expect(result.backgroundDistanceFt).toBe(8)
  })

  it('uses three-quarter focal length mapping', () => {
    const result = computeCriticalOverrides({
      presetId: 'corporate-headshot',
      shotType: 'three-quarter',
      subjectCount: '1',
      usageContext: 'general',
      baseBackgroundDistanceFt: 6
    })

    expect(result.focalLength?.mm).toBe(70)
    expect(result.subjectScalePercent).toBe(75)
    expect(result.backgroundDistanceFt).toBe(8)
  })

  it('applies fashion editorial overrides', () => {
    const result = computeCriticalOverrides({
      presetId: 'fashion-editorial',
      shotType: 'full-length',
      subjectCount: '1',
      usageContext: 'general',
      baseBackgroundDistanceFt: 6
    })

    expect(result.focalLength?.mm).toBe(85)
    expect(result.aperture?.value).toBe('f/2.8')
    expect(result.headroomPercent).toBe(5)
    expect(result.backgroundDistanceFt).toBe(15)
  })

  it('widens focal length for large groups', () => {
    const result = computeCriticalOverrides({
      presetId: 'team-group',
      shotType: 'full-length',
      subjectCount: '9+',
      usageContext: 'general',
      baseBackgroundDistanceFt: 12
    })

    expect(result.focalLength?.mm).toBe(35)
    expect(result.aperture?.value).toBe('f/11')
    expect(result.backgroundDistanceFt).toBe(12)
  })

  it('expands background distance and headroom for social media crop', () => {
    const result = computeCriticalOverrides({
      presetId: 'corporate-headshot',
      shotType: 'medium-shot',
      subjectCount: '2-3',
      usageContext: 'social-media',
      baseBackgroundDistanceFt: 7
    })

    expect(result.aperture?.value).toBe('f/5.6')
    expect(result.headroomPercent).toBe(15)
    expect(result.backgroundDistanceFt).toBe(8)
  })

  it('uses environmental framing distance for wide shots', () => {
    const result = computeCriticalOverrides({
      presetId: 'environmental',
      shotType: 'wide-shot',
      subjectCount: '1',
      usageContext: 'general',
      baseBackgroundDistanceFt: 10
    })

    expect(result.subjectScalePercent).toBe(50)
    expect(result.backgroundDistanceFt).toBe(4)
  })
})

