import type { ClothingSettings, ClothingValue, ClothingStyle, ClothingMode } from './types'
import { predefined, userChoice } from '../base/element-types'

interface LegacyClothingSettings {
  type?: string
  style?: string
  mode?: ClothingMode
  details?: string
  topChoice?: string
  bottomChoice?: string
  outerChoice?: string
  onePieceChoice?: string
  lockScope?: 'style-only'
  colors?: {
    topLayer?: string
    baseLayer?: string
    bottom?: string
    shoes?: string
  }
  accessories?: string[]
}

const LEGACY_ALLOWED_STYLES = new Set(['business', 'startup', 'black-tie'])
const CURRENT_ALLOWED_STYLES = new Set(['business_professional', 'business_casual', 'startup', 'black-tie'])
const ONE_PIECE_DETAILS = new Set(['dress', 'gown', 'jumpsuit', 'pantsuit'])

const STYLE_TOP_CHOICES: Record<ClothingStyle, string[]> = {
  business_professional: ['dress-shirt', 'blouse'],
  business_casual: ['t-shirt', 'button-down', 'polo', 'blouse'],
  startup: ['t-shirt', 'button-down', 'hoodie'],
  'black-tie': ['dress-shirt', 'silk-blouse'],
}

const STYLE_BOTTOM_CHOICES: Record<ClothingStyle, string[]> = {
  business_professional: ['trousers', 'pencil-skirt'],
  business_casual: ['trousers', 'chinos', 'skirt'],
  startup: ['jeans', 'chinos'],
  'black-tie': ['dress-pants', 'formal-skirt'],
}

const STYLE_OUTER_CHOICES: Record<ClothingStyle, string[]> = {
  business_professional: ['suit-jacket', 'jacket'],
  business_casual: ['jacket', 'cardigan'],
  startup: ['jacket', 'hoodie'],
  'black-tie': ['tuxedo-jacket', 'suit-jacket', 'robe'],
}

const STYLE_ONE_PIECE_CHOICES: Record<ClothingStyle, string[]> = {
  business_professional: ['dress', 'pantsuit'],
  business_casual: ['dress'],
  startup: ['jumpsuit'],
  'black-tie': ['dress', 'gown', 'jumpsuit'],
}

function normalizeDetailValue(detail?: string): string | undefined {
  if (!detail || typeof detail !== 'string') return undefined
  const trimmed = detail.trim().toLowerCase()
  if (!trimmed) return undefined
  if (trimmed === 'buttondown') return 'button-down'
  if (trimmed === 'button_down') return 'button-down'
  if (trimmed === 'formal' || trimmed === 'formal-suit') return 'suit'
  if (trimmed === 'casual' || trimmed === 'casual-jacket') return 'jacket'
  return trimmed
}

function normalizeChoiceValue(choice?: string): string | undefined {
  if (!choice || typeof choice !== 'string') return undefined
  const trimmed = choice.trim().toLowerCase()
  if (!trimmed) return undefined
  if (trimmed === 'blazer') return 'jacket'
  return trimmed
}

/**
 * Maps legacy (style, detail) pairs to current taxonomy.
 */
export function migrateLegacyClothing(style?: string, detail?: string): {
  style: ClothingStyle
  details?: string
} {
  const legacyStyle = (style || '').toLowerCase()
  const normalizedDetail = normalizeDetailValue(detail)

  if (legacyStyle === 'black-tie') {
    return {
      style: 'black-tie',
      details: normalizedDetail || 'suit',
    }
  }

  if (legacyStyle === 'business') {
    if (!normalizedDetail || normalizedDetail === 'suit') {
      return { style: 'business_professional', details: 'suit' }
    }

    if (normalizedDetail === 'jacket') {
      return { style: 'business_casual', details: 'jacket' }
    }

    if (normalizedDetail === 'blouse' || normalizedDetail === 'dress' || normalizedDetail === 'pantsuit') {
      return { style: 'business_professional', details: normalizedDetail }
    }

    return { style: 'business_professional', details: 'suit' }
  }

  if (legacyStyle === 'startup') {
    if (!normalizedDetail) {
      return { style: 'startup', details: 't-shirt' }
    }

    if (normalizedDetail === 'polo' || normalizedDetail === 'cardigan' || normalizedDetail === 'blouse' || normalizedDetail === 'dress') {
      return { style: 'business_casual', details: normalizedDetail }
    }

    if (
      normalizedDetail === 't-shirt' ||
      normalizedDetail === 'hoodie' ||
      normalizedDetail === 'button-down' ||
      normalizedDetail === 'jumpsuit'
    ) {
      return { style: 'startup', details: normalizedDetail }
    }

    return { style: 'startup', details: 't-shirt' }
  }

  // Unknown style fallback.
  return {
    style: 'business_professional',
    details: normalizedDetail || 'suit',
  }
}

function normalizeStyle(style?: string): ClothingStyle {
  const normalized = (style || '').toLowerCase()

  if (CURRENT_ALLOWED_STYLES.has(normalized)) {
    return normalized as ClothingStyle
  }

  if (LEGACY_ALLOWED_STYLES.has(normalized)) {
    return migrateLegacyClothing(normalized).style
  }

  return 'business_professional'
}

function deriveDetailFromChoices(style: ClothingStyle, value: {
  mode: ClothingMode
  topChoice?: string
  bottomChoice?: string
  outerChoice?: string
  onePieceChoice?: string
  details?: string
}): string | undefined {
  const explicitDetail = normalizeDetailValue(value.details)
  if (explicitDetail) return explicitDetail

  if (value.mode === 'one_piece') {
    return normalizeChoiceValue(value.onePieceChoice) || 'dress'
  }

  const outerChoice = normalizeChoiceValue(value.outerChoice)
  if (outerChoice) {
    if (outerChoice === 'tuxedo-jacket') return 'tuxedo'
    if (outerChoice === 'suit-jacket') return 'suit'
    if (outerChoice === 'jacket') return style === 'business_professional' ? 'blouse' : 'jacket'
    if (outerChoice === 'cardigan') return 'cardigan'
    if (outerChoice === 'button-down') return 'button-down'
    if (outerChoice === 'robe') return 'gown'
    if (outerChoice === 'hoodie') return 'hoodie'
  }

  const topChoice = normalizeChoiceValue(value.topChoice)
  if (topChoice) {
    if (topChoice === 'polo') return 'polo'
    if (topChoice === 'button-down') return 'button-down'
    if (topChoice === 'hoodie') return 'hoodie'
    if (topChoice === 'blouse') return 'blouse'
    if (topChoice === 't-shirt') return style === 'startup' ? 't-shirt' : 'jacket'
    if (topChoice === 'dress-shirt') return style === 'black-tie' ? 'suit' : 'suit'
    if (topChoice === 'silk-blouse') return 'dress'
  }

  const bottomChoice = normalizeChoiceValue(value.bottomChoice)
  if (bottomChoice === 'formal-skirt') return 'gown'
  if (bottomChoice === 'pencil-skirt' || bottomChoice === 'skirt') return 'dress'

  if (style === 'business_professional') return 'suit'
  if (style === 'business_casual') return 'jacket'
  if (style === 'startup') return 't-shirt'
  return 'suit'
}

function applyDefaultsFromDetail(style: ClothingStyle, detail?: string): Partial<ClothingValue> {
  const normalized = normalizeDetailValue(detail)
  if (!normalized) return {}

  if (ONE_PIECE_DETAILS.has(normalized)) {
    return {
      mode: 'one_piece',
      onePieceChoice: normalized,
    }
  }

  if (normalized === 'tuxedo') {
    return {
      mode: 'separate',
      topChoice: 'dress-shirt',
      bottomChoice: 'dress-pants',
      outerChoice: 'tuxedo-jacket',
    }
  }

  if (normalized === 'suit') {
    return {
      mode: 'separate',
      topChoice: 'dress-shirt',
      bottomChoice: style === 'black-tie' ? 'dress-pants' : 'trousers',
      outerChoice: 'suit-jacket',
    }
  }

  if (normalized === 'jacket') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: style === 'startup' ? 'jeans' : 'trousers',
      outerChoice: 'jacket',
    }
  }

  if (normalized === 'cardigan') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: 'trousers',
      outerChoice: 'cardigan',
    }
  }

  if (normalized === 'button-down') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: style === 'startup' ? 'jeans' : 'trousers',
      outerChoice: 'button-down',
    }
  }

  if (normalized === 'polo') {
    return {
      mode: 'separate',
      topChoice: 'polo',
      bottomChoice: 'trousers',
    }
  }

  if (normalized === 'blouse') {
    return {
      mode: 'separate',
      topChoice: 'blouse',
      bottomChoice: style === 'business_professional' ? 'trousers' : 'skirt',
      outerChoice: style === 'business_professional' ? 'jacket' : undefined,
    }
  }

  if (normalized === 'hoodie') {
    return {
      mode: 'separate',
      topChoice: 'hoodie',
      bottomChoice: 'jeans',
    }
  }

  if (normalized === 't-shirt') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: 'jeans',
    }
  }

  return { mode: 'separate' }
}

function sanitizeChoice(style: ClothingStyle, mode: ClothingMode, value: Partial<ClothingValue>): Partial<ClothingValue> {
  if (mode === 'one_piece') {
    const onePieceChoice = normalizeChoiceValue(value.onePieceChoice)
    const allowed = STYLE_ONE_PIECE_CHOICES[style]
    return {
      onePieceChoice: onePieceChoice && allowed.includes(onePieceChoice) ? onePieceChoice : allowed[0],
      topChoice: undefined,
      bottomChoice: undefined,
      outerChoice: undefined,
    }
  }

  const topChoice = normalizeChoiceValue(value.topChoice)
  const bottomChoice = normalizeChoiceValue(value.bottomChoice)
  const outerChoice = normalizeChoiceValue(value.outerChoice)

  const allowedTop = STYLE_TOP_CHOICES[style]
  const allowedBottom = STYLE_BOTTOM_CHOICES[style]
  const allowedOuter = STYLE_OUTER_CHOICES[style]

  return {
    topChoice: topChoice && allowedTop.includes(topChoice) ? topChoice : allowedTop[0],
    bottomChoice: bottomChoice && allowedBottom.includes(bottomChoice) ? bottomChoice : allowedBottom[0],
    outerChoice: outerChoice && allowedOuter.includes(outerChoice) ? outerChoice : undefined,
    onePieceChoice: undefined,
  }
}

function normalizeClothingValue(value: LegacyClothingSettings | ClothingValue | undefined): ClothingValue | undefined {
  if (!value || typeof value !== 'object') return undefined

  const styleRaw = typeof value.style === 'string' ? value.style : undefined
  const detailRaw = value.details
  const hasExplicitNoOuterChoice =
    Object.prototype.hasOwnProperty.call(value, 'outerChoice') &&
    (value.outerChoice === '' || value.outerChoice === undefined)

  const migrated = migrateLegacyClothing(styleRaw, detailRaw)

  // Preserve current style values that are already in the new taxonomy.
  const normalizedStyle = CURRENT_ALLOWED_STYLES.has((styleRaw || '').toLowerCase())
    ? normalizeStyle(styleRaw)
    : migrated.style

  const normalizedDetails = CURRENT_ALLOWED_STYLES.has((styleRaw || '').toLowerCase())
    ? normalizeDetailValue(detailRaw)
    : migrated.details

  const defaults = applyDefaultsFromDetail(normalizedStyle, normalizedDetails)
  const mode: ClothingMode =
    value.mode === 'one_piece' || value.mode === 'separate'
      ? value.mode
      : (defaults.mode || (normalizedDetails && ONE_PIECE_DETAILS.has(normalizedDetails) ? 'one_piece' : 'separate'))

  const sanitizedChoice = sanitizeChoice(normalizedStyle, mode, {
    topChoice: normalizeChoiceValue(value.topChoice) || defaults.topChoice,
    bottomChoice: normalizeChoiceValue(value.bottomChoice) || defaults.bottomChoice,
    outerChoice: normalizeChoiceValue(value.outerChoice) || defaults.outerChoice,
    onePieceChoice: normalizeChoiceValue(value.onePieceChoice) || defaults.onePieceChoice,
  })

  const details = deriveDetailFromChoices(normalizedStyle, {
    mode,
    topChoice: sanitizedChoice.topChoice,
    bottomChoice: sanitizedChoice.bottomChoice,
    outerChoice: sanitizedChoice.outerChoice,
    onePieceChoice: sanitizedChoice.onePieceChoice,
    details: normalizedDetails,
  })

  return {
    style: normalizedStyle,
    mode,
    details,
    topChoice: sanitizedChoice.topChoice,
    bottomChoice: sanitizedChoice.bottomChoice,
    // Preserve explicit "no top layer" selection as empty string through deserialize.
    outerChoice: hasExplicitNoOuterChoice ? '' : sanitizedChoice.outerChoice,
    onePieceChoice: sanitizedChoice.onePieceChoice,
    lockScope: value.lockScope,
    colors: value.colors,
    accessories: Array.isArray(value.accessories) ? value.accessories : undefined,
  }
}

/**
 * Normalizes a raw clothing setting payload.
 * Accepts either a full settings object (with `clothing`) or a clothing node.
 */
export function normalizeClothingSettings(
  raw: unknown,
  defaults?: ClothingSettings
): ClothingSettings {
  const fallback = defaults || userChoice()

  if (!raw || typeof raw !== 'object') {
    return fallback
  }

  const root = raw as Record<string, unknown>
  const clothingNode =
    'clothing' in root && root.clothing && typeof root.clothing === 'object'
      ? (root.clothing as Record<string, unknown>)
      : root

  if (!clothingNode || typeof clothingNode !== 'object') {
    return fallback
  }

  if ('mode' in clothingNode && typeof clothingNode.mode === 'string') {
    const mode = clothingNode.mode === 'predefined' ? 'predefined' : 'user-choice'
    const normalizedValue = normalizeClothingValue(clothingNode.value as ClothingValue | undefined)

    if (mode === 'predefined') {
      if (!normalizedValue) {
        return predefined({
          style: 'business_professional',
          details: 'suit',
          mode: 'separate',
          topChoice: 'dress-shirt',
          bottomChoice: 'trousers',
          outerChoice: 'suit-jacket',
          lockScope: 'style-only',
        })
      }
      return predefined({
        ...normalizedValue,
        lockScope: 'style-only',
      })
    }

    return normalizedValue ? userChoice(normalizedValue) : userChoice()
  }

  const legacy = clothingNode as LegacyClothingSettings

  if (legacy.style === 'user-choice' || legacy.type === 'user-choice') {
    return userChoice()
  }

  const normalized = normalizeClothingValue(legacy)
  if (!normalized) {
    return predefined({
      style: 'business_professional',
      details: 'suit',
      mode: 'separate',
      topChoice: 'dress-shirt',
      bottomChoice: 'trousers',
      outerChoice: 'suit-jacket',
      lockScope: 'style-only',
    })
  }

  return predefined({
    ...normalized,
    lockScope: 'style-only',
  })
}

/**
 * Deserializes clothing settings from raw data.
 */
export function deserialize(raw: Record<string, unknown>, defaults?: ClothingSettings): ClothingSettings {
  return normalizeClothingSettings(raw, defaults)
}
