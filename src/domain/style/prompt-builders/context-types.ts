import type { PhotoStyleSettings } from '@/types/photo-style'
import type { NestedRecord } from './context'

export interface PromptBuildContext {
  settings: PhotoStyleSettings  // Effective resolved settings
  payload: NestedRecord          // The prompt payload being built
  rules: string[]                // Rules to append at the end of the prompt
}
