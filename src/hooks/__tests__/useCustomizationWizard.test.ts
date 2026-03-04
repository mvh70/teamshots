import { renderHook } from '@testing-library/react'
import type { ComponentType, SVGProps } from 'react'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ElementMetadata } from '@/domain/style/elements/metadata'
import { useCustomizationWizard } from '../useCustomizationWizard'

const NoopIcon = (() => null) as ComponentType<SVGProps<SVGSVGElement>>

const allCategories: ElementMetadata[] = [
  {
    key: 'clothing',
    label: 'Clothing',
    icon: NoopIcon,
    description: 'Clothing settings',
    group: 'userStyle',
  },
  {
    key: 'pose',
    label: 'Pose',
    icon: NoopIcon,
    description: 'Pose settings',
    group: 'composition',
  },
]

function runHook(originalContextSettings?: PhotoStyleSettings) {
  return renderHook(() =>
    useCustomizationWizard({
      value: {} as PhotoStyleSettings,
      originalContextSettings,
      packageId: 'headshot1',
      showToggles: false,
      readonlyPredefined: true,
      allCategories,
    })
  )
}

describe('useCustomizationWizard', () => {
  it('keeps clothing editable when lockScope is style-only', () => {
    const { result } = runHook({
      clothing: {
        mode: 'predefined',
        value: {
          style: 'business_casual',
          lockScope: 'style-only',
        },
      },
      pose: {
        mode: 'predefined',
        value: { type: 'classic_corporate' },
      },
    } as PhotoStyleSettings)

    expect(result.current.currentEditableCategories.map((cat) => cat.key)).toEqual(['clothing'])
    expect(result.current.currentLockedCategories.map((cat) => cat.key)).toEqual(['pose'])
  })

  it('moves clothing to locked section when it is fully predefined', () => {
    const { result } = runHook({
      clothing: {
        mode: 'predefined',
        value: {
          style: 'business_casual',
          details: 'jacket',
        },
      },
      pose: {
        mode: 'predefined',
        value: { type: 'classic_corporate' },
      },
    } as PhotoStyleSettings)

    expect(result.current.currentEditableCategories.map((cat) => cat.key)).toEqual([])
    expect(result.current.currentLockedCategories.map((cat) => cat.key)).toEqual(['clothing', 'pose'])
  })
})
