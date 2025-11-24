import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes background settings from raw data
 */
export function deserialize(raw: Record<string, unknown>): PhotoStyleSettings['background'] {
  const rawBg = raw.background as unknown
  
  if (rawBg && typeof rawBg === 'object') {
    return rawBg as PhotoStyleSettings['background']
  }
  
  type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'
  const allowed: readonly string[] = ['office', 'neutral', 'gradient', 'custom', 'user-choice', 'tropical-beach', 'busy-city']
  const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
  
  return { 
    type: bgType, 
    prompt: (raw['backgroundPrompt'] as string) || undefined 
  }
}

