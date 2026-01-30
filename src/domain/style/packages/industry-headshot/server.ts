import { industryHeadshot } from './index'
import { getIndustryStyleConfig } from '../../elements/industry/industry-styles'
import { predefined, hasValue } from '../../elements/base/element-types'
import type { GenerationContext, GenerationPayload } from '@/types/generation'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { BasePackageServer } from '../../base/BasePackageServer'
import { Telemetry } from '@/lib/telemetry'

export type IndustryHeadshotServerPackage = typeof industryHeadshot & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

class IndustryHeadshotServer extends BasePackageServer {
  constructor() {
    super(industryHeadshot)
  }

  protected resolveEffectiveSettings(userSettings: PhotoStyleSettings): PhotoStyleSettings {
    const baseSettings = super.resolveEffectiveSettings(userSettings)

    // Extract industry from user settings (ElementSetting or legacy string format)
    let industry = 'law-firms'
    if (hasValue(baseSettings.industry)) {
      industry = baseSettings.industry.value.type
    }

    // Get industry-specific styling config
    const config = getIndustryStyleConfig(industry)
    Telemetry.increment(`generation.package.${industryHeadshot.id}.industry.${industry}`)

    // Derive all settings from industry selection — let elements handle prompt generation
    return {
      ...baseSettings,
      background: predefined({
        type: config.background.type,
        prompt: config.background.prompt,
      }),
      clothing: predefined({
        style: config.clothing.style,
        details: config.clothing.details,
      }),
      clothingColors: predefined({
        topLayer: config.clothing.colors.topLayer,
        baseLayer: config.clothing.colors.baseLayer,
      }),
      pose: predefined({
        type: config.pose.type,
      }),
      expression: predefined({
        type: config.expression.type,
      }),
      shotType: predefined({ type: 'medium-shot' }),
    }
  }

}

const serverInstance = new IndustryHeadshotServer()

export const industryHeadshotServer: IndustryHeadshotServerPackage = {
  ...industryHeadshot,
  buildGenerationPayload: (context: GenerationContext) => serverInstance.buildGenerationPayload(context)
}

export default industryHeadshotServer
