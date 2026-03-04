import {
  buildCustomizationStepIndicatorWithSelfie,
  buildSelfieStepIndicator,
  type CustomizationStepsMeta,
} from '@/lib/customizationSteps'

const META: CustomizationStepsMeta = {
  editableSteps: 3,
  allSteps: 4,
  lockedSteps: [2],
  stepNames: ['background', 'pose', 'expression', 'shotType'],
  stepKeys: ['background', 'pose', 'expression', 'shotType'],
}

describe('customization step helpers with beautification prefix', () => {
  it('shifts customization indicators by selfie + beautification', () => {
    const result = buildCustomizationStepIndicatorWithSelfie(META, {
      currentEditableIndex: 1,
      currentAllStepsIndex: 2,
      visitedEditableSteps: [0, 1],
    })

    expect(result.current).toBe(4) // editable step 2 + two prefix steps
    expect(result.total).toBe(5) // 3 editable + 2 prefix
    expect(result.lockedSteps).toEqual([4]) // locked index shifted
    expect(result.currentAllStepsIndex).toBe(4)
    expect(result.visitedEditableSteps).toEqual([0, 1, 2, 3])
  })

  it('reports beautification as the active prefix step on mobile', () => {
    const result = buildSelfieStepIndicator(META, {
      selfieComplete: true,
      beautificationComplete: false,
      currentStep: 'beautification',
    })

    expect(result.current).toBe(2)
    expect(result.currentAllStepsIndex).toBe(1)
    expect(result.total).toBe(5)
  })

  it('uses condensed 3-step model on desktop', () => {
    const result = buildSelfieStepIndicator(META, {
      selfieComplete: true,
      beautificationComplete: true,
      isDesktop: true,
      visitedCustomizationSteps: [0],
      currentStep: 'customization',
    })

    expect(result.total).toBe(3)
    expect(result.current).toBe(3)
    expect(result.currentAllStepsIndex).toBe(2)
    expect(result.visitedEditableSteps).toEqual([0, 1, 2])
  })
})
