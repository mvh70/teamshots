// Targeted test: exact save→navigate→load→merge roundtrip for pose and clothingColors
import { getPackageConfig } from '@/domain/style/packages'
import { predefined, userChoice } from '@/domain/style/elements/base/element-types'
import type { PhotoStyleSettings } from '@/types/photo-style'
import {
  loadStyleSettings,
  saveStyleSettings,
  clearStyleSettings,
} from '@/lib/clothing-colors-storage'
import { mergeSavedUserChoiceStyleSettings } from '@/lib/style-settings-merge'

describe('exact user scenario: save→navigate→load→merge roundtrip', () => {
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

  afterEach(() => {
    clearStyleSettings()
  })

  it('pose: user changes from default → save → fresh defaults → merge → restored', () => {
    const pkg = getPackageConfig('headshot1')
    
    // Step 1: Start with package defaults
    const initial = { ...pkg.defaultSettings }
    console.log('Initial pose:', JSON.stringify(initial.pose))
    
    // Step 2: User changes pose to 'classic_corporate'
    const modified = {
      ...initial,
      pose: userChoice({ type: 'classic_corporate' as const }),
    }
    console.log('Modified pose:', JSON.stringify(modified.pose))
    
    // Step 3: Save (simulating setPhotoStyleSettings → persistStyleSettings)
    saveStyleSettings(modified)
    
    // Step 4: Verify save worked
    const loaded = loadStyleSettings()
    console.log('Loaded pose:', JSON.stringify(loaded?.pose))
    expect(loaded).not.toBeNull()
    expect(loaded?.pose?.value?.type).toBe('classic_corporate')
    
    // Step 5: User navigates away, comes back → component remounts with fresh defaults
    const freshDefaults = { ...pkg.defaultSettings }
    console.log('Fresh defaults pose:', JSON.stringify(freshDefaults.pose))
    
    // Step 6: Merge saved settings into fresh defaults (simulating hydration effect)
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: freshDefaults,
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })
    
    console.log('Merged pose:', JSON.stringify(merged.pose))
    
    // Step 7: Assert pose was restored
    expect(merged.pose?.mode).toBe('user-choice')
    expect(merged.pose?.value?.type).toBe('classic_corporate')
  })

  it('clothingColors: user changes colors → save → fresh defaults → merge → restored', () => {
    const pkg = getPackageConfig('headshot1')
    
    // Step 1: Start with package defaults (clothingColors has no value)
    const initial = { ...pkg.defaultSettings }
    console.log('Initial clothingColors:', JSON.stringify(initial.clothingColors))
    
    // Step 2: User selects colors
    const modified = {
      ...initial,
      clothingColors: userChoice({ topLayer: '#FF0000', baseLayer: '#00FF00' }),
    }
    
    // Step 3: Save
    saveStyleSettings(modified)
    
    // Step 4: Load
    const loaded = loadStyleSettings()
    expect(loaded).not.toBeNull()
    
    // Step 5: Fresh defaults
    const freshDefaults = { ...pkg.defaultSettings }
    
    // Step 6: Merge
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: freshDefaults,
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })
    
    console.log('Merged clothingColors:', JSON.stringify(merged.clothingColors))
    
    // Step 7: Assert colors were restored
    expect(merged.clothingColors?.mode).toBe('user-choice')
    expect(merged.clothingColors?.value?.topLayer).toBe('#FF0000')
    expect(merged.clothingColors?.value?.baseLayer).toBe('#00FF00')
  })

  it('clothing: user changes outfit → save → fresh defaults → merge → restored', () => {
    const pkg = getPackageConfig('headshot1')
    
    const modified = {
      ...pkg.defaultSettings,
      clothing: userChoice({
        style: 'business_casual' as const,
        mode: 'separate' as const,
        topChoice: 'button-down',
        bottomChoice: 'trousers',
        outerChoice: 'jacket',
        details: 'button-down',
      }),
    }
    
    saveStyleSettings(modified)
    const loaded = loadStyleSettings()
    
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: { ...pkg.defaultSettings },
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })
    
    expect(merged.clothing?.mode).toBe('user-choice')
    expect(merged.clothing?.value?.style).toBe('business_casual')
    expect(merged.clothing?.value?.topChoice).toBe('button-down')
  })

  it('background: user changes bg → save → fresh defaults → merge → restored', () => {
    const pkg = getPackageConfig('headshot1')
    
    const modified = {
      ...pkg.defaultSettings,
      background: userChoice({ type: 'tropical-beach' as const }),
    }
    
    saveStyleSettings(modified)
    const loaded = loadStyleSettings()
    
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: { ...pkg.defaultSettings },
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })
    
    expect(merged.background?.mode).toBe('user-choice')
    expect(merged.background?.value?.type).toBe('tropical-beach')
  })

  it('multiple changes: all persist across roundtrip', () => {
    const pkg = getPackageConfig('headshot1')

    const modified = {
      ...pkg.defaultSettings,
      pose: userChoice({ type: 'power_cross' as const }),
      background: userChoice({ type: 'office' as const }),
      clothingColors: userChoice({ topLayer: '#AABB11', bottom: '#CC22DD' }),
      clothing: userChoice({
        style: 'startup' as const,
        mode: 'separate' as const,
        topChoice: 'hoodie',
        bottomChoice: 'jeans',
        details: 'hoodie',
      }),
    }

    saveStyleSettings(modified)
    const loaded = loadStyleSettings()

    const merged = mergeSavedUserChoiceStyleSettings({
      settings: { ...pkg.defaultSettings },
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })

    expect(merged.pose?.value?.type).toBe('power_cross')
    expect(merged.background?.value?.type).toBe('office')
    expect(merged.clothingColors?.value?.topLayer).toBe('#AABB11')
    expect(merged.clothing?.value?.style).toBe('startup')
  })

  /**
   * KEY SCENARIO: Server returns PREDEFINED settings (from DB context with admin-set values).
   * User changes to user-choice. Navigate away and back includes beautification page visit.
   * This simulates: user sees power_cross (predefined) → changes to classic_corporate (user-choice)
   * → navigates to selfies → navigates back → beautification page → customization.
   */
  it('predefined server settings: user-choice changes survive navigate-back with beautification page in between', () => {
    const pkg = getPackageConfig('headshot1')

    // Step 1: Server returns PREDEFINED settings (simulating a DB context)
    const serverSettings: PhotoStyleSettings = {
      ...pkg.defaultSettings,
      pose: predefined({ type: 'power_cross' as const }),
      clothingColors: predefined({ topLayer: 'navy', baseLayer: 'white', bottom: 'gray' }),
      background: predefined({ type: 'office' as const }),
    }

    // Step 2: User changes pose and clothingColors to user-choice
    const userModified: PhotoStyleSettings = {
      ...serverSettings,
      pose: userChoice({ type: 'classic_corporate' as const }),
      clothingColors: userChoice({ topLayer: '#8B0000', baseLayer: 'white', bottom: 'gray' }),
    }

    // Step 3: Wrapper persists to sessionStorage
    saveStyleSettings(userModified)

    // Step 4: Verify save
    const savedAfterUserEdit = loadStyleSettings()
    expect(savedAfterUserEdit?.pose?.mode).toBe('user-choice')
    expect(savedAfterUserEdit?.pose?.value?.type).toBe('classic_corporate')
    expect(savedAfterUserEdit?.clothingColors?.mode).toBe('user-choice')
    expect(savedAfterUserEdit?.clothingColors?.value?.topLayer).toBe('#8B0000')

    // Step 5: User navigates away (to selfies) - sessionStorage untouched

    // Step 6: User navigates back → first mount of StartGenerationClient
    // Hydration merge runs but does NOT persist (guard prevents it)
    // The merge result is: server predefined + saved user-choice values
    const firstMountMerge = mergeSavedUserChoiceStyleSettings({
      settings: { ...serverSettings },
      savedSettings: savedAfterUserEdit,
      visibleCategories: pkg.visibleCategories,
    })
    // Verify first mount merge produces correct values
    expect(firstMountMerge.pose?.value?.type).toBe('classic_corporate')
    expect(firstMountMerge.clothingColors?.value?.topLayer).toBe('#8B0000')

    // Step 7: Redirect to beautification page
    // Beautification page loads from session, adds beautification, saves
    const currentSession = loadStyleSettings() || ({} as PhotoStyleSettings)
    const withBeautification = {
      ...currentSession,
      beautification: userChoice({ retouching: 'light' as const }),
    }
    saveStyleSettings(withBeautification as PhotoStyleSettings)

    // Step 8: Verify beautification save preserved user settings
    const afterBeautification = loadStyleSettings()
    expect(afterBeautification?.pose?.mode).toBe('user-choice')
    expect(afterBeautification?.pose?.value?.type).toBe('classic_corporate')
    expect(afterBeautification?.clothingColors?.value?.topLayer).toBe('#8B0000')
    expect(afterBeautification?.beautification?.mode).toBe('user-choice')

    // Step 9: Second mount of StartGenerationClient with skipUpload=true
    // Server returns SAME predefined settings again
    const secondMountMerge = mergeSavedUserChoiceStyleSettings({
      settings: { ...serverSettings },
      savedSettings: afterBeautification,
      visibleCategories: pkg.visibleCategories,
    })

    // Step 10: Assert user's changes survived the full navigate-back flow
    expect(secondMountMerge.pose?.value?.type).toBe('classic_corporate')
    expect(secondMountMerge.clothingColors?.value?.topLayer).toBe('#8B0000')
  })

  it('predefined server settings: merge into predefined preserves saved type even when mode stays predefined', () => {
    const pkg = getPackageConfig('headshot1')

    // Server has predefined pose
    const serverSettings: PhotoStyleSettings = {
      ...pkg.defaultSettings,
      pose: predefined({ type: 'power_cross' as const }),
      clothingColors: predefined({ topLayer: 'navy', baseLayer: 'white', bottom: 'gray' }),
    }

    // User changed to user-choice, saved to session
    const userSaved: PhotoStyleSettings = {
      ...serverSettings,
      pose: userChoice({ type: 'classic_corporate' as const }),
      clothingColors: userChoice({ topLayer: '#8B0000', baseLayer: 'white', bottom: 'gray' }),
    }
    saveStyleSettings(userSaved)
    const loaded = loadStyleSettings()

    // Merge: server predefined + saved user-choice
    const merged = mergeSavedUserChoiceStyleSettings({
      settings: { ...serverSettings },
      savedSettings: loaded,
      visibleCategories: pkg.visibleCategories,
    })

    // The saved value's TYPE should be used (classic_corporate, not power_cross)
    // Mode might change to predefined (via mergePredefinedFromSession), that's OK
    // as long as the value is correct
    expect(merged.pose?.value?.type).toBe('classic_corporate')
    expect(merged.clothingColors?.value?.topLayer).toBe('#8B0000')
  })
})
