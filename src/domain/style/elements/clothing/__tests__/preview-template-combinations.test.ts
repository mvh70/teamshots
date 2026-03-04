import fs from 'node:fs'
import path from 'node:path'
import {
  getBottomChoicesForUser,
  getOnePieceChoicesForUser,
  getOuterChoicesForUser,
  getPreviewTemplateForLayer,
  getTopChoicesForUser,
  normalizeClothingValueWithChoices,
} from '@/domain/style/elements/clothing/config'
import type { ClothingStyle } from '@/domain/style/elements/clothing/types'

const STYLES: ClothingStyle[] = [
  'business_professional',
  'business_casual',
  'startup',
  'black-tie',
]

const BASE_LAYER_USES_TOPLAYER_ASSET_CHOICES = new Set([
  't-shirt',
  'button-down',
  'polo',
  'blouse',
  'hoodie',
  'silk-blouse',
])

const EXPECTED_TOP_DETAIL_BY_STYLE: Record<ClothingStyle, Record<string, string>> = {
  business_professional: {
    'dress-shirt': 'suit',
    blouse: 'blouse',
  },
  business_casual: {
    't-shirt': 'jacket',
    'button-down': 'button-down',
    polo: 'polo',
    blouse: 'blouse',
  },
  startup: {
    't-shirt': 't-shirt',
    'button-down': 'button-down',
    hoodie: 'hoodie',
  },
  'black-tie': {
    'dress-shirt': 'suit',
    'silk-blouse': 'dress',
  },
}

const EXPECTED_OUTER_DETAIL_BY_STYLE: Record<ClothingStyle, Record<string, string>> = {
  business_professional: {
    'suit-jacket': 'suit',
    jacket: 'blouse',
  },
  business_casual: {
    jacket: 'jacket',
    cardigan: 'cardigan',
  },
  startup: {
    jacket: 'button-down',
    hoodie: 'hoodie',
  },
  'black-tie': {
    'tuxedo-jacket': 'tuxedo',
    'suit-jacket': 'suit',
    robe: 'gown',
  },
}

const EXPECTED_BOTTOM_DETAIL_BY_STYLE: Record<ClothingStyle, Record<string, string>> = {
  business_professional: {
    trousers: 'suit',
    'pencil-skirt': 'dress',
  },
  business_casual: {
    trousers: 'jacket',
    chinos: 'polo',
    skirt: 'dress',
  },
  startup: {
    jeans: 't-shirt',
    chinos: 'button-down',
  },
  'black-tie': {
    'dress-pants': 'suit',
    'formal-skirt': 'gown',
  },
}

function expectImageExists(style: ClothingStyle, detail: string, layer: 'toplayer' | 'baselayer' | 'bottom') {
  const imagePath = path.join(
    process.cwd(),
    'public',
    'images',
    'clothing',
    `${style}-${detail}-${layer}.webp`
  )
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing clothing preview asset: ${imagePath}`)
  }
}

describe('preview template mappings for all garment combinations', () => {
  it('maps all separate-mode top/base/bottom combinations to expected templates and assets', () => {
    for (const style of STYLES) {
      const tops = getTopChoicesForUser(style)
      const bottoms = getBottomChoicesForUser(style)
      const outers = ['', ...getOuterChoicesForUser(style)]

      for (const topChoice of tops) {
        for (const bottomChoice of bottoms) {
          for (const outerChoice of outers) {
            const normalized = normalizeClothingValueWithChoices({
              style,
              mode: 'separate',
              topChoice,
              bottomChoice,
              outerChoice,
            })

            const baseTemplate = getPreviewTemplateForLayer(normalized, 'baseLayer')
            const topTemplate = getPreviewTemplateForLayer(normalized, 'topLayer')
            const bottomTemplate = getPreviewTemplateForLayer(normalized, 'bottom')

            const expectedBaseTemplate = EXPECTED_TOP_DETAIL_BY_STYLE[style][topChoice]
            const expectedTopTemplate = outerChoice
              ? EXPECTED_OUTER_DETAIL_BY_STYLE[style][outerChoice]
              : undefined
            const expectedBottomTemplate = EXPECTED_BOTTOM_DETAIL_BY_STYLE[style][bottomChoice]

            expect(baseTemplate).toBe(expectedBaseTemplate)
            expect(topTemplate).toBe(expectedTopTemplate)
            expect(bottomTemplate).toBe(expectedBottomTemplate)

            if (BASE_LAYER_USES_TOPLAYER_ASSET_CHOICES.has(topChoice)) {
              expectImageExists(style, expectedBaseTemplate, 'toplayer')
            } else {
              expectImageExists(style, expectedBaseTemplate, 'baselayer')
            }
            expectImageExists(style, expectedBottomTemplate, 'bottom')
            if (expectedTopTemplate) {
              expectImageExists(style, expectedTopTemplate, 'toplayer')
            }
          }
        }
      }
    }
  })

  it('maps all one-piece choices to one-piece templates and assets', () => {
    for (const style of STYLES) {
      const onePieceChoices = getOnePieceChoicesForUser(style)
      for (const onePieceChoice of onePieceChoices) {
        const normalized = normalizeClothingValueWithChoices({
          style,
          mode: 'one_piece',
          onePieceChoice,
        })

        const topTemplate = getPreviewTemplateForLayer(normalized, 'topLayer')
        const baseTemplate = getPreviewTemplateForLayer(normalized, 'baseLayer')

        expect(topTemplate).toBe(onePieceChoice)
        expect(baseTemplate).toBeUndefined()
        expectImageExists(style, onePieceChoice, 'toplayer')
      }
    }
  })
})
