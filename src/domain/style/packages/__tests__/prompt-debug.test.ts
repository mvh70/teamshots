/**
 * Debug test: builds the full prompt for headshot1 with beautification.
 *
 * Run with:
 *   npx jest src/domain/style/packages/__tests__/prompt-debug.test.ts --no-coverage
 */

// Mock prisma and DB-dependent services
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }))
jest.mock('@/domain/services/CostTrackingService', () => ({
  CostTrackingService: { trackGeneration: jest.fn() },
}))

import type { PhotoStyleSettings } from '@/types/photo-style'
import { userChoice } from '@/domain/style/elements/base/element-types'
import { getPackageConfig } from '@/domain/style/packages'
import type { BeautificationValue } from '@/domain/style/elements/beautification/types'
import { compositionRegistry } from '@/domain/style/elements/composition/registry'

// Manually import and register elements (auto-registration may fail due to mocks)
import { SubjectElement } from '@/domain/style/elements/subject/element'
import { BeautificationElement } from '@/domain/style/elements/beautification/element'
import { ExpressionElement } from '@/domain/style/elements/expression/element'
import { PoseElement } from '@/domain/style/elements/pose/element'
import { BackgroundElement } from '@/domain/style/elements/background/element'
import { ShotTypeElement } from '@/domain/style/elements/shot-type/element'
import { CameraSettingsElement } from '@/domain/style/elements/camera-settings/element'
import { LightingElement } from '@/domain/style/elements/lighting/element'
import { AspectRatioElement } from '@/domain/style/elements/aspect-ratio/element'
import { ClothingElement } from '@/domain/style/elements/clothing/element'
import { ClothingColorsElement } from '@/domain/style/elements/clothing-colors/element'

beforeAll(() => {
  // Register elements that don't need DB
  const elements = [
    new SubjectElement(),
    new BeautificationElement(),
    new ExpressionElement(),
    new PoseElement(),
    new BackgroundElement(),
    new ShotTypeElement(),
    new CameraSettingsElement(),
    new LightingElement(),
    new AspectRatioElement(),
    new ClothingElement(),
    new ClothingColorsElement(),
  ]
  for (const el of elements) {
    try { compositionRegistry.register(el) } catch { /* already registered */ }
  }
})

describe('prompt-debug: full headshot1 prompt', () => {
  it('builds complete person-generation prompt with remove-glasses beautification', async () => {
    const pkg = getPackageConfig('headshot1')

    const settings: PhotoStyleSettings = {
      ...pkg.defaultSettings,
      background: userChoice({ type: 'neutral' }),
      beautification: userChoice<BeautificationValue>({
        retouching: 'light',
        accessories: {
          glasses: { action: 'remove' },
          facialHair: { action: 'keep' },
          jewelry: { action: 'keep' },
          piercings: { action: 'keep' },
          tattoos: { action: 'keep' },
        },
      }),
    }

    const context = {
      phase: 'person-generation' as const,
      settings,
      packageContext: { packageId: 'headshot1' },
      generationContext: {
        selfieS3Keys: ['test-selfie.jpg'],
        personId: 'test-person',
        generationId: 'test-gen',
        hasFaceComposite: false,
        hasBodyComposite: false,
      },
      existingContributions: [],
    }

    const contributions = await compositionRegistry.composeContributions(context)

    console.log('\n========== FULL PROMPT PAYLOAD ==========')
    console.log(JSON.stringify(contributions.payload, null, 2))

    console.log('\n========== MUST-FOLLOW RULES ==========')
    for (const rule of contributions.mustFollow || []) {
      console.log(`  - ${rule}`)
    }

    console.log('\n========== FREEDOM RULES ==========')
    for (const rule of contributions.freedom || []) {
      console.log(`  - ${rule}`)
    }

    console.log('\n========== REGISTERED ELEMENTS ==========')
    for (const el of compositionRegistry.getAll()) {
      const relevant = el.isRelevantForPhase(context)
      console.log(`  ${relevant ? '✓' : '✗'} ${el.id} (priority: ${el.priority})`)
    }

    // Key assertions
    const mustFollow = contributions.mustFollow || []
    expect(mustFollow.some(r => r.includes('Remove glasses'))).toBe(true)
    expect(mustFollow.some(r => r.includes('retouching'))).toBe(true)

    const payload = contributions.payload as Record<string, unknown>
    const subject = payload.subject as Record<string, unknown> | undefined
    expect(subject?.expression).toBeDefined()
    expect(subject?.expression).toEqual(
      expect.objectContaining({
        type: 'soft_smile',
      })
    )
    expect(subject?.beautification).toBeDefined()
    expect(
      mustFollow.some((r) => r.includes('The mouth MUST be closed with lips together. No teeth visible.'))
    ).toBe(true)
  })
})
