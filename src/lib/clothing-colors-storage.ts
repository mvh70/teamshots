import type { ClothingColorValue } from '@/domain/style/elements/clothing-colors/types'
import { beautificationValueSchema, normalizeBeautificationValue } from '@/domain/style/elements/beautification/schema'
import type { BeautificationValue } from '@/domain/style/elements/beautification/types'
import type { PhotoStyleSettings } from '@/types/photo-style'

const STORAGE_KEY = 'teamshots_clothing_colors'
const STYLE_SETTINGS_KEY = 'teamshots_style_settings'
export const STYLE_SETTINGS_CHANGED_EVENT = 'styleSettingsChanged'

// ============================================
// Full PhotoStyleSettings persistence
// ============================================

export function saveStyleSettings(
  settings: PhotoStyleSettings,
  contextId?: string | null
): void {
  if (typeof window === 'undefined') return

  try {
    const existing = loadStyleSettings(contextId)
    const nextSettings: PhotoStyleSettings =
      existing &&
      existing.beautification !== undefined &&
      settings.beautification === undefined
        ? ({
            ...settings,
            beautification: existing.beautification,
          } as PhotoStyleSettings)
        : settings

    // Save with context ID to allow different settings per context
    const key = contextId ? `${STYLE_SETTINGS_KEY}_${contextId}` : STYLE_SETTINGS_KEY
    sessionStorage.setItem(key, JSON.stringify(nextSettings))
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent(STYLE_SETTINGS_CHANGED_EVENT, { detail: { contextId } }))
  } catch (error) {
    console.warn('Failed to save style settings to session:', error)
  }
}

export function loadStyleSettings(
  contextId?: string | null
): PhotoStyleSettings | null {
  if (typeof window === 'undefined') return null

  try {
    const key = contextId ? `${STYLE_SETTINGS_KEY}_${contextId}` : STYLE_SETTINGS_KEY
    const stored = sessionStorage.getItem(key)
    if (!stored) return null

    const parsed = JSON.parse(stored)

    // Basic validation - ensure it's an object
    if (typeof parsed !== 'object' || parsed === null) return null

    return parsed as PhotoStyleSettings
  } catch (error) {
    console.warn('Failed to load style settings from session:', error)
    return null
  }
}

export function clearStyleSettings(contextId?: string | null): void {
  if (typeof window === 'undefined') return

  try {
    const key = contextId ? `${STYLE_SETTINGS_KEY}_${contextId}` : STYLE_SETTINGS_KEY
    sessionStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to clear style settings from session:', error)
  }
}

export function hasSavedBeautificationSettings(contextId?: string | null): boolean {
  const settings = loadStyleSettings(contextId)
  if (!settings || typeof settings !== 'object') return false

  const beautification = (settings as Record<string, unknown>).beautification
  if (!beautification || typeof beautification !== 'object') return false

  const candidate = (beautification as { value?: unknown }).value ?? beautification
  return beautificationValueSchema.safeParse(candidate).success
}

export function readSavedBeautification(scope?: string | null): BeautificationValue | null {
  const saved = loadStyleSettings(scope)
  if (!saved) return null
  const candidate = (saved as Record<string, unknown>).beautification
  if (!candidate || typeof candidate !== 'object') return null
  const value = (candidate as { value?: unknown }).value
  if (value === undefined) return null
  return normalizeBeautificationValue(value)
}

// ============================================
// ClothingColors-only persistence (legacy)
// ============================================

export function saveClothingColors(
  colors: ClothingColorValue
): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch (error) {
    console.warn('Failed to save clothing colors to session:', error)
  }
}

export function loadClothingColors(): ClothingColorValue | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const parsed = JSON.parse(stored)
    
    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) return null
    
    // Ensure all values are strings (basic validation)
    const validColors: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        validColors[key] = value
      }
    }
    
    if (Object.keys(validColors).length === 0) return null
    
    return validColors as ClothingColorValue
  } catch (error) {
    console.warn('Failed to load clothing colors from session:', error)
    return null
  }
}

export function clearClothingColors(): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear clothing colors from session:', error)
  }
}
