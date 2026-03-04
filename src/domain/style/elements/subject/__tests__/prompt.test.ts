import {
  generateSubjectCompositionPrompt,
  generateSubjectPersonPrompt,
} from '../prompt'

describe('subject prompt beautification coordination', () => {
  it('keeps legacy grooming and accessory guidance when beautification is absent', () => {
    const personPrompt = generateSubjectPersonPrompt({
      selfieCount: 3,
      hasFaceComposite: true,
      hasBodyComposite: true,
    })

    const hardRequirements = personPrompt.identityPayload.hard_requirements as string[]
    expect(hardRequirements.some((rule) => rule.toLowerCase().includes('groom the subject'))).toBe(true)
    expect(hardRequirements.some((rule) => rule.toLowerCase().includes('preserve accessories'))).toBe(true)

    const compositionPrompt = generateSubjectCompositionPrompt({
      hasFaceComposite: true,
      hasBodyComposite: true,
    })
    expect((compositionPrompt.identityPayload.grooming as string | undefined) ?? '').toContain(
      'Groom the subject slightly'
    )
    expect(compositionPrompt.identityPayload.skin_quality).toEqual(
      expect.stringContaining('Preserve skin exactly as visible in STEP1A/BASE IMAGE')
    )
    expect(compositionPrompt.identityPayload.skin_quality).not.toEqual(
      expect.stringContaining('hyper realistic')
    )
    expect(compositionPrompt.identityPayload.selfie_reference_scope).toEqual(
      expect.stringContaining('do not transfer or invent new skin marks from selfies')
    )
  })

  it('removes legacy grooming and accessory guidance when beautification is present', () => {
    const personPrompt = generateSubjectPersonPrompt({
      selfieCount: 3,
      hasFaceComposite: true,
      hasBodyComposite: true,
      hasBeautification: true,
    })

    const hardRequirements = personPrompt.identityPayload.hard_requirements as string[]
    expect(hardRequirements.some((rule) => rule.toLowerCase().includes('groom the subject'))).toBe(false)
    expect(hardRequirements.some((rule) => rule.toLowerCase().includes('preserve accessories'))).toBe(false)

    const compositionPrompt = generateSubjectCompositionPrompt({
      hasFaceComposite: true,
      hasBodyComposite: true,
      hasBeautification: true,
    })
    expect(compositionPrompt.identityPayload.grooming).toBeUndefined()
  })

  it('prioritizes a soft-smile-like selfie when configured', () => {
    const personPrompt = generateSubjectPersonPrompt({
      selfieCount: 3,
      hasFaceComposite: true,
      hasBodyComposite: true,
      preferSoftSmileSelfie: true,
    })

    expect(personPrompt.identityPayload.source).toEqual(
      expect.stringContaining('prioritizing the selfie that most closely matches a soft smile expression')
    )

    const compositionPrompt = generateSubjectCompositionPrompt({
      hasFaceComposite: true,
      hasBodyComposite: true,
      preferSoftSmileSelfie: true,
    })

    expect(compositionPrompt.identityPayload.refinement_goal).toEqual(
      expect.stringContaining('using the most soft-smile-like selfie as the expression baseline')
    )
  })
})
