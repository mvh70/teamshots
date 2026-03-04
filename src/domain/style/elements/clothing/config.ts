import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import type {
  ClothingSettings,
  ClothingValue,
  ClothingStyle,
  LegacyClothingStyle,
  AnyClothingStyle,
  ClothingDetectedGender,
  ClothingMode,
} from './types'
import type { ElementConfig } from '../registry'
import { predefined, userChoice, hasValue } from '../base/element-types'
import { deserialize } from './deserializer'

export type {
  ClothingSettings,
  ClothingValue,
  ClothingStyle,
  LegacyClothingStyle,
  AnyClothingStyle,
  ClothingType,
  ClothingDetectedGender,
  ClothingMode,
} from './types'

/**
 * Canonical style type used by prompt/config systems.
 */
export type KnownClothingStyle = ClothingStyle

export type ClothingSlot = 'top' | 'bottom' | 'outer' | 'onePiece'

const FALLBACK_DETAIL_BY_STYLE: Record<KnownClothingStyle, string> = {
  business_professional: 'suit',
  business_casual: 'jacket',
  startup: 't-shirt',
  'black-tie': 'suit',
}

/**
 * Wardrobe detail configuration structure.
 */
export interface WardrobeDetailConfig {
  details: string
  baseLayer: string
  outerLayer?: string
  notes?: string
  excludeClothingColors?: ClothingColorKey[]
  inherentAccessories?: string[]
}

/**
 * UI metadata for clothing style selector.
 * Labels are sourced from i18n, these are value/icon hints only.
 */
export const CLOTHING_STYLES: Array<{ value: ClothingStyle; icon: string; color: string }> = [
  { value: 'business_professional', icon: '💼', color: 'from-blue-600 to-indigo-600' },
  { value: 'business_casual', icon: '👔', color: 'from-cyan-600 to-sky-600' },
  { value: 'startup', icon: '👕', color: 'from-orange-500 to-amber-500' },
  { value: 'black-tie', icon: '🎩', color: 'from-gray-800 to-gray-900' },
]

/**
 * Legacy detail options per style.
 * Kept for backward compatibility with persisted settings and descriptor lookup.
 */
export const CLOTHING_DETAILS: Record<ClothingStyle, string[]> = {
  business_professional: ['suit', 'pantsuit', 'blouse', 'dress'],
  business_casual: ['jacket', 'button-down', 'polo', 'cardigan', 'blouse', 'dress'],
  startup: ['t-shirt', 'hoodie', 'button-down', 'jumpsuit'],
  'black-tie': ['tuxedo', 'suit', 'dress', 'gown', 'jumpsuit'],
}

const CLOTHING_LAYER_CHOICES: Record<ClothingStyle, Record<ClothingSlot, string[]>> = {
  business_professional: {
    top: ['dress-shirt', 'blouse'],
    bottom: ['trousers', 'pencil-skirt'],
    outer: ['suit-jacket', 'jacket'],
    onePiece: ['dress', 'pantsuit'],
  },
  business_casual: {
    top: ['t-shirt', 'button-down', 'polo', 'blouse'],
    bottom: ['trousers', 'chinos', 'skirt'],
    outer: ['jacket', 'cardigan'],
    onePiece: ['dress'],
  },
  startup: {
    top: ['t-shirt', 'button-down', 'hoodie'],
    bottom: ['jeans', 'chinos'],
    outer: ['jacket', 'hoodie'],
    onePiece: ['jumpsuit'],
  },
  'black-tie': {
    top: ['dress-shirt', 'silk-blouse'],
    bottom: ['dress-pants', 'formal-skirt'],
    outer: ['tuxedo-jacket', 'suit-jacket', 'robe'],
    onePiece: ['dress', 'gown', 'jumpsuit'],
  },
}

const ONE_PIECE_DETAILS = new Set(['dress', 'gown', 'jumpsuit', 'pantsuit'])

const CHOICE_TO_DETAIL_TOP: Record<string, string> = {
  'business_professional:dress-shirt': 'suit',
  'business_professional:blouse': 'blouse',
  'business_casual:t-shirt': 'jacket',
  'business_casual:button-down': 'button-down',
  'business_casual:polo': 'polo',
  'business_casual:blouse': 'blouse',
  'startup:t-shirt': 't-shirt',
  'startup:button-down': 'button-down',
  'startup:hoodie': 'hoodie',
  'black-tie:dress-shirt': 'suit',
  'black-tie:silk-blouse': 'dress',
}

const CHOICE_TO_DETAIL_OUTER: Record<string, string> = {
  'business_professional:suit-jacket': 'suit',
  'business_professional:jacket': 'blouse',
  'business_casual:jacket': 'jacket',
  'business_casual:cardigan': 'cardigan',
  'startup:jacket': 'button-down',
  'startup:hoodie': 'hoodie',
  'black-tie:tuxedo-jacket': 'tuxedo',
  'black-tie:suit-jacket': 'suit',
  'black-tie:robe': 'gown',
}

const CHOICE_TO_DETAIL_BOTTOM: Record<string, string> = {
  'business_professional:trousers': 'suit',
  'business_professional:pencil-skirt': 'dress',
  'business_casual:trousers': 'jacket',
  'business_casual:chinos': 'polo',
  'business_casual:skirt': 'dress',
  'startup:jeans': 't-shirt',
  'startup:chinos': 'button-down',
  'black-tie:dress-pants': 'suit',
  'black-tie:formal-skirt': 'gown',
}

const CHOICE_TO_DETAIL_ONE_PIECE: Record<string, string> = {
  dress: 'dress',
  gown: 'gown',
  jumpsuit: 'jumpsuit',
  pantsuit: 'pantsuit',
}

export type DetailGender = 'neutral' | 'male' | 'female'

/**
 * Gender targeting for legacy detail options.
 */
const DETAIL_GENDER_BY_STYLE_DETAIL: Record<string, DetailGender> = {
  'business_professional-suit': 'neutral',
  'business_professional-pantsuit': 'female',
  'business_professional-blouse': 'female',
  'business_professional-dress': 'female',
  'business_casual-jacket': 'neutral',
  'business_casual-button-down': 'neutral',
  'business_casual-polo': 'neutral',
  'business_casual-cardigan': 'neutral',
  'business_casual-blouse': 'female',
  'business_casual-dress': 'female',
  'startup-t-shirt': 'neutral',
  'startup-hoodie': 'neutral',
  'startup-button-down': 'neutral',
  'startup-jumpsuit': 'female',
  'black-tie-tuxedo': 'male',
  'black-tie-suit': 'male',
  'black-tie-dress': 'female',
  'black-tie-gown': 'female',
  'black-tie-jumpsuit': 'female',
}

const CHOICE_GENDER_BY_STYLE_SLOT_CHOICE: Record<string, DetailGender> = {
  'business_professional:top:dress-shirt': 'male',
  'business_professional:top:blouse': 'female',
  'business_professional:bottom:trousers': 'neutral',
  'business_professional:bottom:pencil-skirt': 'female',
  'business_professional:outer:suit-jacket': 'neutral',
  'business_professional:outer:jacket': 'neutral',
  'business_professional:onePiece:dress': 'female',
  'business_professional:onePiece:pantsuit': 'female',
  'business_casual:top:t-shirt': 'neutral',
  'business_casual:top:button-down': 'neutral',
  'business_casual:top:polo': 'neutral',
  'business_casual:top:blouse': 'female',
  'business_casual:bottom:trousers': 'neutral',
  'business_casual:bottom:chinos': 'neutral',
  'business_casual:bottom:skirt': 'female',
  'business_casual:outer:jacket': 'neutral',
  'business_casual:outer:cardigan': 'neutral',
  'business_casual:onePiece:dress': 'female',
  'startup:top:t-shirt': 'neutral',
  'startup:top:button-down': 'neutral',
  'startup:top:hoodie': 'neutral',
  'startup:bottom:jeans': 'neutral',
  'startup:bottom:chinos': 'neutral',
  'startup:outer:jacket': 'neutral',
  'startup:outer:hoodie': 'neutral',
  'startup:onePiece:jumpsuit': 'female',
  'black-tie:top:dress-shirt': 'male',
  'black-tie:top:silk-blouse': 'female',
  'black-tie:bottom:dress-pants': 'male',
  'black-tie:bottom:formal-skirt': 'female',
  'black-tie:outer:tuxedo-jacket': 'male',
  'black-tie:outer:suit-jacket': 'neutral',
  'black-tie:outer:robe': 'neutral',
  'black-tie:onePiece:dress': 'female',
  'black-tie:onePiece:gown': 'female',
  'black-tie:onePiece:jumpsuit': 'female',
}

/**
 * Accessories per style/detail combination.
 */
export const CLOTHING_ACCESSORIES: Record<string, string[]> = {
  'business_professional-suit': ['tie', 'vest', 'pocket-square'],
  'business_professional-pantsuit': ['belt', 'watch'],
  'business_professional-blouse': ['watch', 'necklace'],
  'business_professional-dress': ['watch', 'earrings'],
  'business_casual-jacket': ['vest', 'pocket-square'],
  'business_casual-button-down': ['watch', 'glasses'],
  'business_casual-polo': ['watch', 'glasses'],
  'business_casual-cardigan': ['watch', 'earrings'],
  'business_casual-blouse': ['watch', 'necklace'],
  'business_casual-dress': ['watch', 'earrings'],
  startup: ['watch', 'glasses', 'hat'],
  'black-tie': ['bowtie', 'cufflinks', 'pocket-square', 'gloves'],
}

type AccessoryGender = 'neutral' | 'male' | 'female'

const ACCESSORY_GENDER: Record<string, AccessoryGender> = {
  watch: 'neutral',
  glasses: 'neutral',
  hat: 'neutral',
  belt: 'neutral',
  vest: 'neutral',
  'pocket-square': 'neutral',
  gloves: 'neutral',
  tie: 'male',
  bowtie: 'male',
  cufflinks: 'male',
  necklace: 'female',
  earrings: 'female',
}

function normalizeDetectedGender(gender?: string | null): ClothingDetectedGender {
  const normalized = (gender || '').toLowerCase()
  if (normalized === 'male') return 'male'
  if (normalized === 'female') return 'female'
  return 'unknown'
}

function normalizeStyle(style?: string | null): KnownClothingStyle {
  const normalized = (style || '').toLowerCase()
  if (
    normalized === 'business_professional' ||
    normalized === 'business_casual' ||
    normalized === 'startup' ||
    normalized === 'black-tie'
  ) {
    return normalized
  }
  if (normalized === 'business') return 'business_professional'
  return 'business_professional'
}

function normalizeDetailValue(detail?: string): string | undefined {
  if (!detail || typeof detail !== 'string') return undefined
  const trimmed = detail.trim().toLowerCase()
  if (!trimmed) return undefined
  if (trimmed === 'buttondown' || trimmed === 'button_down') return 'button-down'
  if (trimmed === 'formal' || trimmed === 'formal-suit') return 'suit'
  if (trimmed === 'casual' || trimmed === 'casual-jacket') return 'jacket'
  return trimmed
}

function normalizeChoiceValue(choice?: string): string | undefined {
  if (!choice || typeof choice !== 'string') return undefined
  const normalized = choice.trim().toLowerCase()
  if (normalized === 'blazer') return 'jacket'
  return normalized
}

function filterChoicesByGender(style: ClothingStyle, slot: ClothingSlot, gender?: string | null): string[] {
  const allChoices = CLOTHING_LAYER_CHOICES[style][slot]
  const normalizedGender = normalizeDetectedGender(gender)
  if (normalizedGender === 'unknown') {
    return allChoices
  }

  return allChoices.filter((choice) => {
    const target = CHOICE_GENDER_BY_STYLE_SLOT_CHOICE[`${style}:${slot}:${choice}`] || 'neutral'
    return target === 'neutral' || target === normalizedGender
  })
}

function getChoiceBuckets(style: ClothingStyle, slot: ClothingSlot): {
  male: string[]
  female: string[]
  neutral: string[]
} {
  const buckets: { male: string[]; female: string[]; neutral: string[] } = {
    male: [],
    female: [],
    neutral: [],
  }

  const all = CLOTHING_LAYER_CHOICES[style][slot] || []
  all.forEach((choice) => {
    const target = CHOICE_GENDER_BY_STYLE_SLOT_CHOICE[`${style}:${slot}:${choice}`] || 'neutral'
    buckets[target].push(choice)
  })
  return buckets
}

function mapOnePieceChoiceToDetail(onePieceChoice?: string): string | undefined {
  const normalized = normalizeChoiceValue(onePieceChoice)
  if (!normalized) return undefined
  return CHOICE_TO_DETAIL_ONE_PIECE[normalized] || normalized
}

function mapOuterChoiceToDetail(style: KnownClothingStyle, outerChoice?: string): string | undefined {
  const normalized = normalizeChoiceValue(outerChoice)
  if (!normalized) return undefined
  return CHOICE_TO_DETAIL_OUTER[`${style}:${normalized}`]
}

function mapTopChoiceToDetail(style: KnownClothingStyle, topChoice?: string): string | undefined {
  const normalized = normalizeChoiceValue(topChoice)
  if (!normalized) return undefined
  return CHOICE_TO_DETAIL_TOP[`${style}:${normalized}`]
}

function mapBottomChoiceToDetail(style: KnownClothingStyle, bottomChoice?: string): string | undefined {
  const normalized = normalizeChoiceValue(bottomChoice)
  if (!normalized) return undefined
  return CHOICE_TO_DETAIL_BOTTOM[`${style}:${normalized}`]
}

function applyDetailDefaults(style: KnownClothingStyle, detail?: string): Partial<ClothingValue> {
  const normalizedDetail = normalizeDetailValue(detail)
  if (!normalizedDetail) return {}

  if (ONE_PIECE_DETAILS.has(normalizedDetail)) {
    return {
      mode: 'one_piece',
      onePieceChoice: normalizedDetail,
      topChoice: undefined,
      bottomChoice: undefined,
      outerChoice: undefined,
    }
  }

  if (normalizedDetail === 'tuxedo') {
    return {
      mode: 'separate',
      topChoice: 'dress-shirt',
      bottomChoice: 'dress-pants',
      outerChoice: 'tuxedo-jacket',
    }
  }

  if (normalizedDetail === 'suit') {
    return {
      mode: 'separate',
      topChoice: style === 'black-tie' ? 'dress-shirt' : 'dress-shirt',
      bottomChoice: style === 'black-tie' ? 'dress-pants' : 'trousers',
      outerChoice: style === 'black-tie' ? 'suit-jacket' : 'suit-jacket',
    }
  }

  if (normalizedDetail === 'jacket') {
    return {
      mode: 'separate',
      topChoice: style === 'startup' ? 't-shirt' : 't-shirt',
      bottomChoice: style === 'startup' ? 'jeans' : 'trousers',
      outerChoice: 'jacket',
    }
  }

  if (normalizedDetail === 'cardigan') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: 'trousers',
      outerChoice: 'cardigan',
    }
  }

  if (normalizedDetail === 'button-down') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: style === 'startup' ? 'jeans' : 'trousers',
      outerChoice: 'button-down',
    }
  }

  if (normalizedDetail === 'polo') {
    return {
      mode: 'separate',
      topChoice: 'polo',
      bottomChoice: 'trousers',
      outerChoice: undefined,
    }
  }

  if (normalizedDetail === 'blouse') {
    return {
      mode: 'separate',
      topChoice: 'blouse',
      bottomChoice: style === 'business_professional' ? 'trousers' : 'skirt',
      outerChoice: style === 'business_professional' ? 'jacket' : undefined,
    }
  }

  if (normalizedDetail === 'hoodie') {
    return {
      mode: 'separate',
      topChoice: 'hoodie',
      bottomChoice: 'jeans',
      outerChoice: undefined,
    }
  }

  if (normalizedDetail === 't-shirt') {
    return {
      mode: 'separate',
      topChoice: 't-shirt',
      bottomChoice: 'jeans',
      outerChoice: undefined,
    }
  }

  return {
    mode: 'separate',
  }
}

function ensureChoiceInStyle(
  style: KnownClothingStyle,
  slot: ClothingSlot,
  choice?: string
): string | undefined {
  const normalized = normalizeChoiceValue(choice)
  if (!normalized) return undefined
  const choices = CLOTHING_LAYER_CHOICES[style][slot] || []
  return choices.includes(normalized) ? normalized : undefined
}

/**
 * Returns substyle details filtered by detected gender.
 */
export function getDetailsForUser(style: ClothingStyle, gender?: string | null): string[] {
  const all = CLOTHING_DETAILS[style] || []
  const normalizedGender = normalizeDetectedGender(gender)
  if (normalizedGender === 'unknown') {
    return all
  }

  return all.filter((detail) => {
    const target = DETAIL_GENDER_BY_STYLE_DETAIL[`${style}-${detail}`] || 'neutral'
    return target === 'neutral' || target === normalizedGender
  })
}

export function getDetailsByGenderForStyle(style: ClothingStyle): {
  male: string[]
  female: string[]
  neutral: string[]
} {
  const buckets: { male: string[]; female: string[]; neutral: string[] } = {
    male: [],
    female: [],
    neutral: [],
  }

  const all = CLOTHING_DETAILS[style] || []
  all.forEach((detail) => {
    const target = DETAIL_GENDER_BY_STYLE_DETAIL[`${style}-${detail}`] || 'neutral'
    buckets[target].push(detail)
  })

  return buckets
}

export function getTopChoicesForUser(style: ClothingStyle, gender?: string | null): string[] {
  return filterChoicesByGender(style, 'top', gender)
}

export function getBottomChoicesForUser(style: ClothingStyle, gender?: string | null): string[] {
  return filterChoicesByGender(style, 'bottom', gender)
}

export function getOuterChoicesForUser(style: ClothingStyle, gender?: string | null): string[] {
  return filterChoicesByGender(style, 'outer', gender)
}

export function getOnePieceChoicesForUser(style: ClothingStyle, gender?: string | null): string[] {
  return filterChoicesByGender(style, 'onePiece', gender)
}

export function getTopChoicesByGenderForStyle(style: ClothingStyle) {
  return getChoiceBuckets(style, 'top')
}

export function getBottomChoicesByGenderForStyle(style: ClothingStyle) {
  return getChoiceBuckets(style, 'bottom')
}

export function getOnePieceChoicesByGenderForStyle(style: ClothingStyle) {
  return getChoiceBuckets(style, 'onePiece')
}

/**
 * Returns accessories for style/detail, filtered by detected gender when known.
 */
export function getAccessoriesForClothing(
  style: string,
  detail?: string,
  gender?: string | null
): string[] {
  const normalizedGender = normalizeDetectedGender(gender)

  let accessories: string[]
  if (detail) {
    const compoundKey = `${style}-${detail}`
    if (CLOTHING_ACCESSORIES[compoundKey]) {
      accessories = CLOTHING_ACCESSORIES[compoundKey]
    } else {
      accessories = CLOTHING_ACCESSORIES[style] || []
    }
  } else {
    accessories = CLOTHING_ACCESSORIES[style] || []
  }

  if (normalizedGender === 'unknown') {
    return accessories
  }

  return accessories.filter((accessory) => {
    const target = ACCESSORY_GENDER[accessory] || 'neutral'
    return target === 'neutral' || target === normalizedGender
  })
}

export function getEffectiveClothingMode(value?: Partial<ClothingValue> | null): ClothingMode {
  if (value?.mode === 'one_piece' || value?.mode === 'separate') {
    return value.mode
  }
  if (value?.onePieceChoice) {
    return 'one_piece'
  }
  const detail = normalizeDetailValue(value?.details)
  if (detail && ONE_PIECE_DETAILS.has(detail)) {
    return 'one_piece'
  }
  return 'separate'
}

export function getEffectiveClothingDetail(
  style: ClothingStyle | string | undefined,
  value?: Partial<ClothingValue> | null
): string | undefined {
  const styleKey = normalizeStyle(style)
  const mode = getEffectiveClothingMode(value)
  if (mode === 'one_piece') {
    const mappedOnePiece = mapOnePieceChoiceToDetail(value?.onePieceChoice)
    if (mappedOnePiece) return mappedOnePiece

    // Allow explicit one-piece detail as fallback when no explicit choice was set.
    const explicitDetail = normalizeDetailValue(value?.details)
    if (explicitDetail && ONE_PIECE_DETAILS.has(explicitDetail)) {
      return explicitDetail
    }

    return FALLBACK_DETAIL_BY_STYLE[styleKey]
  }

  const fromOuter = mapOuterChoiceToDetail(styleKey, value?.outerChoice)
  if (fromOuter) return fromOuter

  const fromTop = mapTopChoiceToDetail(styleKey, value?.topChoice)
  if (fromTop) return fromTop

  const fromBottom = mapBottomChoiceToDetail(styleKey, value?.bottomChoice)
  if (fromBottom) return fromBottom

  // For separate mode, explicit detail is only used when no slot-derived detail exists.
  // Ignore stale one-piece details that can linger after mode switches.
  const explicitDetail = normalizeDetailValue(value?.details)
  if (explicitDetail && !ONE_PIECE_DETAILS.has(explicitDetail)) {
    return explicitDetail
  }

  return FALLBACK_DETAIL_BY_STYLE[styleKey]
}

export function normalizeClothingValueWithChoices(input: ClothingValue): ClothingValue {
  const styleKey = normalizeStyle(input.style)
  const detail = normalizeDetailValue(input.details)
  const defaultsFromDetail = applyDetailDefaults(styleKey, detail)
  const hasOwn = (key: keyof ClothingValue) => Object.prototype.hasOwnProperty.call(input, key)
  const hasExplicitNoOuterChoice =
    hasOwn('outerChoice') &&
    (input.outerChoice === '' || input.outerChoice === undefined)

  const mode = getEffectiveClothingMode({
    ...defaultsFromDetail,
    ...input,
  })

  const topChoiceInput = hasOwn('topChoice') ? input.topChoice : defaultsFromDetail.topChoice
  const bottomChoiceInput = hasOwn('bottomChoice') ? input.bottomChoice : defaultsFromDetail.bottomChoice
  const outerChoiceInput = hasOwn('outerChoice') ? input.outerChoice : defaultsFromDetail.outerChoice
  const onePieceChoiceInput = hasOwn('onePieceChoice') ? input.onePieceChoice : defaultsFromDetail.onePieceChoice

  const topChoice = ensureChoiceInStyle(styleKey, 'top', topChoiceInput)
  const bottomChoice = ensureChoiceInStyle(styleKey, 'bottom', bottomChoiceInput)
  const outerChoice = ensureChoiceInStyle(styleKey, 'outer', outerChoiceInput)
  const onePieceChoice = ensureChoiceInStyle(styleKey, 'onePiece', onePieceChoiceInput)

  const normalized: ClothingValue = {
    ...input,
    style: styleKey,
    mode,
    topChoice: mode === 'separate' ? topChoice : undefined,
    bottomChoice: mode === 'separate' ? bottomChoice : undefined,
    // Preserve explicit "no top layer" selection as empty string so it survives JSON/session roundtrips.
    outerChoice: mode === 'separate' ? (hasExplicitNoOuterChoice ? '' : outerChoice) : undefined,
    onePieceChoice: mode === 'one_piece' ? onePieceChoice : undefined,
  }

  if (mode === 'separate') {
    const styleTopChoices = getTopChoicesForUser(styleKey)
    const styleBottomChoices = getBottomChoicesForUser(styleKey)
    normalized.topChoice = normalized.topChoice || styleTopChoices[0]
    normalized.bottomChoice = normalized.bottomChoice || styleBottomChoices[0]
  } else {
    const styleOnePieceChoices = getOnePieceChoicesForUser(styleKey)
    normalized.onePieceChoice = normalized.onePieceChoice || styleOnePieceChoices[0]
  }

  normalized.details = getEffectiveClothingDetail(styleKey, normalized)
  return normalized
}

export function getPreviewTemplateForLayer(
  clothing: Partial<ClothingValue> | undefined,
  layer: 'topLayer' | 'baseLayer' | 'bottom'
): string | undefined {
  if (!clothing?.style) return undefined
  const styleKey = normalizeStyle(clothing.style)
  const mode = getEffectiveClothingMode(clothing)

  if (mode === 'one_piece') {
    const detail = mapOnePieceChoiceToDetail(clothing.onePieceChoice) || getEffectiveClothingDetail(styleKey, clothing)
    if (!detail) return undefined
    if (layer === 'baseLayer') return undefined
    return detail
  }

  if (layer === 'topLayer') {
    return mapOuterChoiceToDetail(styleKey, clothing.outerChoice)
  }

  if (layer === 'baseLayer') {
    return mapTopChoiceToDetail(styleKey, clothing.topChoice) || getEffectiveClothingDetail(styleKey, clothing)
  }

  return (
    mapBottomChoiceToDetail(styleKey, clothing.bottomChoice) ||
    mapTopChoiceToDetail(styleKey, clothing.topChoice) ||
    getEffectiveClothingDetail(styleKey, clothing)
  )
}

function mergeStyleOnlyPredefinedClothingFromSession(params: {
  currentSetting: ClothingSettings
  savedValue: unknown
}): ClothingSettings | undefined {
  const currentSetting = params.currentSetting
  if (currentSetting.mode !== 'predefined' || !hasValue(currentSetting) || !currentSetting.value) {
    return undefined
  }

  const currentValue = currentSetting.value
  if (currentValue.lockScope !== 'style-only' || !currentValue.style) {
    return undefined
  }

  if (!params.savedValue || typeof params.savedValue !== 'object') {
    return undefined
  }

  const savedValue = params.savedValue as Partial<ClothingValue>
  if (savedValue.style && savedValue.style !== currentValue.style) {
    return undefined
  }

  return predefined(
    normalizeClothingValueWithChoices({
      ...currentValue,
      ...savedValue,
      style: currentValue.style,
      lockScope: 'style-only',
    })
  )
}

/**
 * Element registry config for clothing.
 */
export const clothingElementConfig: ElementConfig<ClothingSettings> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults && hasValue(packageDefaults)) {
      return predefined(normalizeClothingValueWithChoices({ ...packageDefaults.value }))
    }
    return predefined({
      style: 'business_professional',
      lockScope: 'style-only',
      mode: 'separate',
      topChoice: 'dress-shirt',
      bottomChoice: 'trousers',
      outerChoice: 'suit-jacket',
      details: 'suit',
    })
  },
  getDefaultUserChoice: () => userChoice(),
  deserialize,
  mergePredefinedFromSession: mergeStyleOnlyPredefinedClothingFromSession,
}
