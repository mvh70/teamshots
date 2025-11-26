import type { PhotoStyleSettings } from '@/types/photo-style'
import type { NestedRecord } from './context'

export interface PromptBuildContext {
  settings: PhotoStyleSettings  // Effective resolved settings
  payload: NestedRecord          // The prompt payload being built
  mustFollowRules: string[]      // Must follow rules (critical constraints)
  freedomRules: string[]         // Freedom rules (creative liberties)
}
