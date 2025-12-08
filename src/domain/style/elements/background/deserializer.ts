import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes background settings from raw data
 *
 * Supports both legacy S3 key and new assetId fields.
 * If assetId is provided, it takes precedence over the key.
 */
type BgType =
  | 'office'
  | 'neutral'
  | 'gradient'
  | 'custom'
  | 'user-choice'
  | 'tropical-beach'
  | 'busy-city'

type Background = NonNullable<PhotoStyleSettings['background']>

export function deserialize(raw: Record<string, unknown>): PhotoStyleSettings['background'] {
  const rawBg = raw.background as Record<string, unknown> | unknown

  if (rawBg && typeof rawBg === 'object') {
    const bgObj = rawBg as Record<string, unknown>

    const allowed: readonly string[] = [
      'office',
      'neutral',
      'gradient',
      'custom',
      'user-choice',
      'tropical-beach',
      'busy-city'
    ]

    const typeValue = (allowed.includes(bgObj.type as string) ? bgObj.type : 'user-choice') as BgType

    const result: Background = {
      type: typeValue,
      key: typeof bgObj.key === 'string' ? bgObj.key : undefined,
      assetId: typeof bgObj.assetId === 'string' ? bgObj.assetId : undefined,
      prompt: typeof bgObj.prompt === 'string' ? bgObj.prompt : undefined,
      color: typeof bgObj.color === 'string' ? bgObj.color : undefined,
      environment: typeof bgObj.environment === 'string' ? (bgObj.environment as Background['environment']) : undefined,
      modifier: typeof bgObj.modifier === 'string' ? (bgObj.modifier as Background['modifier']) : undefined
    }

    // Add assetId if it exists in raw data
    if (typeof bgObj.assetId === 'string') {
      result.assetId = bgObj.assetId
    }

    return result
  }

  const allowed: readonly string[] = ['office', 'neutral', 'gradient', 'custom', 'user-choice', 'tropical-beach', 'busy-city']
  const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType

  return {
    type: bgType,
    prompt: (raw['backgroundPrompt'] as string) || undefined
  }
}

/**
 * Resolves background assetId from settings
 * Returns assetId if present, otherwise returns undefined (caller can use key)
 */
export function getBackgroundAssetId(background?: PhotoStyleSettings['background']): string | undefined {
  if (!background) return undefined
  return background.assetId
}

/**
 * Gets the effective background key (prefers assetId, falls back to key)
 * Use this when you need an identifier for the background image
 */
export function getBackgroundIdentifier(background?: PhotoStyleSettings['background']): string | undefined {
  if (!background) return undefined
  return background.assetId ?? background.key
}

