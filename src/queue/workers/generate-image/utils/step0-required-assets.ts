import type { PhotoStyleSettings } from '@/types/photo-style'
import { hasValue } from '@/domain/style/elements/base/element-types'
import type { PreparedAsset } from '@/domain/style/elements/composition'

export function getRequiredStep0AssetErrors(
  styleSettings: PhotoStyleSettings,
  preparedAssets?: Map<string, PreparedAsset>
): string[] {
  const errors: string[] = []

  const backgroundValue =
    styleSettings.background && hasValue(styleSettings.background) ? styleSettings.background.value : undefined
  const brandingValue =
    styleSettings.branding && hasValue(styleSettings.branding) ? styleSettings.branding.value : undefined
  const clothingValue =
    styleSettings.clothing && hasValue(styleSettings.clothing) ? styleSettings.clothing.value : undefined

  const preparedBackground = preparedAssets?.get('background-custom-background')
  const hasPreparedBackground = !!preparedBackground?.data.base64
  const preparedBackgroundMetadata = preparedBackground?.data.metadata as Record<string, unknown> | undefined
  const preBrandedWithLogo = preparedBackgroundMetadata?.preBrandedWithLogo === true

  if (backgroundValue?.type === 'custom' && !hasPreparedBackground) {
    errors.push('Custom background requested but Step 0 did not prepare a background buffer.')
  }

  const requiresBackgroundBrandingAsset =
    brandingValue?.type === 'include' &&
    (brandingValue.position === 'background' || brandingValue.position === 'elements')
  if (requiresBackgroundBrandingAsset) {
    if (!hasPreparedBackground) {
      errors.push(
        `Branding on ${brandingValue.position} requires pre-branded background asset, but background buffer is missing.`
      )
    } else if (!preBrandedWithLogo) {
      errors.push(
        `Branding on ${brandingValue.position} requires pre-branded background asset, but metadata.preBrandedWithLogo is not true.`
      )
    }
  }

  const requiresClothingOverlay =
    brandingValue?.type === 'include' &&
    brandingValue.position === 'clothing' &&
    !!clothingValue
  if (requiresClothingOverlay) {
    const hasClothingOverlay = !!preparedAssets?.get('clothing-overlay-overlay')?.data.base64
    if (!hasClothingOverlay) {
      errors.push('Clothing branding requires prepared clothing overlay, but Step 0 did not prepare one.')
    }
  }

  return errors
}
