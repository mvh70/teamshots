import {
  SELFIE_CLASSIFICATION_ANALYSIS_VERSION,
  needsClassificationReanalysis,
  toSelfieClassification,
  type ClassificationResult,
} from '../selfie-types'

describe('toSelfieClassification accessories versioning', () => {
  it('stores v2 when accessories are present', () => {
    const result: ClassificationResult = {
      selfieType: 'front_view',
      confidence: 0.95,
      personCount: 1,
      isProper: true,
      accessories: {
        glasses: {
          detected: true,
          type: 'prescription',
          confidence: 0.92,
        },
      },
    }

    const classification = toSelfieClassification(result)
    expect(classification.version).toBe(2)
    expect('accessories' in classification).toBe(true)
    expect(classification.analysis?.version).toBe(SELFIE_CLASSIFICATION_ANALYSIS_VERSION)
    expect(classification.analysis?.keys.accessories).toBe(true)
  })

  it('keeps v1 when accessories are absent', () => {
    const result: ClassificationResult = {
      selfieType: 'front_view',
      confidence: 0.95,
      personCount: 1,
      isProper: true,
    }

    const classification = toSelfieClassification(result)
    expect(classification.version).toBe(1)
    expect('accessories' in classification).toBe(false)
    expect(classification.analysis?.version).toBe(SELFIE_CLASSIFICATION_ANALYSIS_VERSION)
    expect(classification.analysis?.keys.demographics).toBe(true)
  })

  it('marks legacy payloads for re-analysis', () => {
    const legacyPayload = {
      selfieType: 'front_view',
      confidence: 0.92,
      personCount: 1,
      isProper: true,
    }

    expect(needsClassificationReanalysis(legacyPayload)).toBe(true)
  })

  it('marks modern payloads without analysis metadata for re-analysis', () => {
    const payloadWithoutAnalysis = {
      version: 1,
      type: { value: 'front_view', confidence: 0.95 },
      personCount: 1,
      proper: { isProper: true },
      lighting: { quality: 'good' },
      background: { quality: 'good' },
      demographics: {},
    }

    expect(needsClassificationReanalysis(payloadWithoutAnalysis)).toBe(true)
  })

  it('does not re-analyze fresh payloads with current analysis metadata', () => {
    const result: ClassificationResult = {
      selfieType: 'front_view',
      confidence: 0.95,
      personCount: 1,
      isProper: true,
    }

    const classification = toSelfieClassification(result)
    expect(needsClassificationReanalysis(classification)).toBe(false)
  })
})
