import { getPackageConfig } from '@/domain/style/packages'
import { userChoice } from '@/domain/style/elements/base/element-types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import {
  clearStyleSettings,
  loadStyleSettings,
  saveStyleSettings,
} from '@/lib/clothing-colors-storage'
import { mergeSavedUserChoiceStyleSettings } from '@/lib/style-settings-merge'

describe('style settings session persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    ;(window.sessionStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      store.has(key) ? store.get(key)! : null
    )
    ;(window.sessionStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      store.set(key, String(value))
    })
    ;(window.sessionStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      store.delete(key)
    })
    ;(window.sessionStorage.clear as jest.Mock).mockImplementation(() => {
      store.clear()
    })
  })

  it('reload roundtrip keeps separate outfit choices', () => {
    const styleSettings: PhotoStyleSettings = {
      clothing: userChoice({
        style: 'business_casual',
        mode: 'separate',
        outerChoice: 'jacket',
        topChoice: 'button-down',
        bottomChoice: 'trousers',
        details: 'button-down',
      }),
      clothingColors: userChoice({
        topLayer: '#111111',
        baseLayer: '#eeeeee',
        bottom: '#222222',
      }),
    }

    saveStyleSettings(styleSettings)
    const loaded = loadStyleSettings()

    expect(loaded?.clothing?.value?.style).toBe('business_casual')
    expect(loaded?.clothing?.value?.mode).toBe('separate')
    expect(loaded?.clothing?.value?.outerChoice).toBe('jacket')
    expect(loaded?.clothing?.value?.topChoice).toBe('button-down')
    expect(loaded?.clothing?.value?.bottomChoice).toBe('trousers')

    const pkg = getPackageConfig('headshot1')
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: pkg.defaultSettings,
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })

    expect(merged.clothing?.value?.style).toBe('business_casual')
    expect(merged.clothing?.value?.mode).toBe('separate')
    expect(merged.clothing?.value?.outerChoice).toBe('jacket')
    expect(merged.clothing?.value?.topChoice).toBe('button-down')
    expect(merged.clothing?.value?.bottomChoice).toBe('trousers')
  })

  it('reload roundtrip keeps explicit no-top-layer and one-piece choices', () => {
    const noTopLayerSettings: PhotoStyleSettings = {
      clothing: userChoice({
        style: 'business_casual',
        mode: 'separate',
        outerChoice: '',
        topChoice: 'button-down',
        bottomChoice: 'trousers',
        details: 'button-down',
      }),
    }

    saveStyleSettings(noTopLayerSettings)
    const loadedNoTop = loadStyleSettings()
    expect(loadedNoTop?.clothing?.value?.outerChoice).toBe('')

    const onePieceSettings: PhotoStyleSettings = {
      clothing: userChoice({
        style: 'black-tie',
        mode: 'one_piece',
        onePieceChoice: 'gown',
        details: 'gown',
      }),
    }

    saveStyleSettings(onePieceSettings)
    const loadedOnePiece = loadStyleSettings()

    expect(loadedOnePiece?.clothing?.value?.mode).toBe('one_piece')
    expect(loadedOnePiece?.clothing?.value?.onePieceChoice).toBe('gown')
    expect(loadedOnePiece?.clothing?.value?.outerChoice).toBeUndefined()
    expect(loadedOnePiece?.clothing?.value?.topChoice).toBeUndefined()
    expect(loadedOnePiece?.clothing?.value?.bottomChoice).toBeUndefined()
  })

  afterEach(() => {
    clearStyleSettings()
  })
})
