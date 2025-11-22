import { Logger } from '@/lib/logger'
import sharp from 'sharp'
import type { Step3Input, Step3Output } from '@/types/generation'

/**
 * Step 3: Prepare background and scene specifications
 * Always runs - handles custom backgrounds, prompt-based backgrounds, and extracts scene specs
 */
export async function executeStep3(input: Step3Input): Promise<Step3Output> {
  const { styleSettings, downloadAsset } = input
  
  Logger.info('V2 Step 3: Preparing background assets', {
    backgroundType: styleSettings.background?.type,
    brandingType: styleSettings.branding?.type,
    brandingPosition: styleSettings.branding?.position
  })
  
  const result: Step3Output = {}
  
  // Handle custom background
  if (styleSettings.background?.type === 'custom' && styleSettings.background.key) {
    Logger.debug('V2 Step 3: Downloading custom background')
    try {
      const backgroundAsset = await downloadAsset(styleSettings.background.key)
      if (backgroundAsset) {
        const backgroundBuffer = Buffer.from(backgroundAsset.base64, 'base64')
        result.backgroundBuffer = await sharp(backgroundBuffer).png().toBuffer()
        Logger.info('V2 Step 3: Custom background loaded', {
          bufferSize: result.backgroundBuffer.length
        })
      }
    } catch (error) {
      Logger.error('V2 Step 3: Failed to download custom background', {
        error: error instanceof Error ? error.message : String(error),
        key: styleSettings.background.key
      })
      throw new Error('Step 3: Failed to download custom background asset')
    }
  } else if (styleSettings.background?.type) {
    // Use background instructions from package prompt
    result.backgroundInstructions = `Generate ${styleSettings.background.type} background as specified in the prompt`
    Logger.info('V2 Step 3: Using prompt-based background', {
      backgroundType: styleSettings.background.type
    })
  }
  
  // Handle logo if branding is in background or element position
  if (styleSettings.branding?.type === 'include' && 
      styleSettings.branding.position &&
      ['background', 'element'].includes(styleSettings.branding.position) &&
      styleSettings.branding.logoKey) {
    Logger.debug('V2 Step 3: Downloading logo for background/element branding')
    try {
      const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
      if (logoAsset) {
        const logoBuffer = Buffer.from(logoAsset.base64, 'base64')
        result.logoBuffer = await sharp(logoBuffer).png().toBuffer()
        Logger.info('V2 Step 3: Logo loaded', {
          bufferSize: result.logoBuffer.length,
          position: styleSettings.branding.position
        })
      }
    } catch (error) {
      Logger.error('V2 Step 3: Failed to download logo', {
        error: error instanceof Error ? error.message : String(error),
        key: styleSettings.branding.logoKey
      })
      throw new Error('Step 3: Failed to download logo asset')
    }
  }
  
  Logger.info('V2 Step 3: Background preparation completed', {
    hasCustomBackground: !!result.backgroundBuffer,
    hasBackgroundInstructions: !!result.backgroundInstructions,
    hasLogo: !!result.logoBuffer
  })
  
  return result
}

