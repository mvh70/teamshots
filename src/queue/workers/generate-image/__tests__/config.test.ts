import { STAGE_MODEL, STAGE_RESOLUTION } from '../config'

describe('generate-image stage configuration', () => {
  it('routes step1a and step2 to Gemini 3 with step2 at 2K', () => {
    expect(STAGE_MODEL.STEP_1A_PERSON).toBe('gemini-3-pro-image')
    expect(STAGE_MODEL.STEP_2_COMPOSITION).toBe('gemini-3-pro-image')
    expect(STAGE_RESOLUTION.STEP_1A_PERSON).toBe('2K')
    expect(STAGE_RESOLUTION.STEP_2_COMPOSITION).toBe('2K')
  })
})
