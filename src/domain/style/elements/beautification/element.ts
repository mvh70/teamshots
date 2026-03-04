import { getPackageConfig } from '@/domain/style/packages'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { hasValue } from '../base/element-types'
import { ElementContext, ElementContribution, StyleElement } from '../base/StyleElement'
import { autoRegisterElement } from '../composition/registry'
import { generateBeautificationPrompt } from './prompt'
import type { BeautificationValue } from './types'

export class BeautificationElement extends StyleElement {
  readonly id = 'beautification'
  readonly name = 'Beautification'
  readonly description = 'Retouching intensity and accessory preservation/removal'

  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings, packageContext } = context
    if (phase !== 'person-generation' && phase !== 'composition') {
      return false
    }

    const beautification = settings.beautification
    if (!beautification || !hasValue(beautification)) {
      return false
    }

    const packageId = packageContext?.packageId
    if (!packageId) {
      return false
    }

    const packageConfig = getPackageConfig(packageId)
    return Boolean(packageConfig.metadata?.capabilities?.supportsBeautification)
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const beautification = context.settings.beautification
    if (!beautification || !hasValue(beautification)) {
      return {}
    }

    const value = beautification.value as BeautificationValue
    const prompt = generateBeautificationPrompt(value)

    if (context.phase === 'person-generation') {
      return {
        mustFollow: prompt.accessoryMustFollow,
        payload: {
          subject: {
            beautification: {
              accessories: value.accessories ?? {},
            },
          },
        },
        metadata: {
          ...prompt.metadata,
          phase: context.phase,
        },
      }
    }

    return {
      mustFollow: prompt.retouchingMustFollow,
      payload: prompt.payload,
      metadata: {
        ...prompt.metadata,
        phase: context.phase,
      },
    }
  }

  validate(settings: PhotoStyleSettings): string[] {
    const beautification = settings.beautification
    if (!beautification || !hasValue(beautification)) {
      return []
    }

    const retouching = beautification.value?.retouching
    if (!['none', 'light', 'medium', 'high', 'max'].includes(retouching)) {
      return [`Invalid beautification retouching level: ${String(retouching)}`]
    }

    return []
  }

  get priority(): number {
    return 35
  }
}

export const beautificationElement = new BeautificationElement()
export default beautificationElement

autoRegisterElement(beautificationElement)
