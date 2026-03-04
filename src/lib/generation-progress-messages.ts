/**
 * Generation Progress Messages
 * 
 * Maps preprocessing steps to user-friendly (sometimes humorous) messages
 */

export interface ProgressMessage {
  message: string
  emoji?: string
}

const STEP_MESSAGES: Record<string, ProgressMessage[]> = {
  'background-person-removed': [
    { message: 'Transforming you into a LinkedIn legend...', emoji: '⚡' },
    { message: 'Your professional glow-up is happening...', emoji: '✨' },
    { message: 'Crafting photos that make recruiters pause...', emoji: '🎯' },
    { message: 'Building your best professional self...', emoji: '🚀' },
    { message: 'Almost there - prepare to be impressed...', emoji: '🌟' },
    { message: 'Your future self is thanking you right now...', emoji: '💫' },
    { message: 'Making you look like you own the room...', emoji: '👑' },
    { message: 'Crafting photos that open doors...', emoji: '🗝️' },
  ],
  'logo-placed-on-clothing': [
    { message: 'Adding that final professional touch...', emoji: '💼' },
    { message: 'Your brand is shining through...', emoji: '⭐' },
    { message: 'Creating your signature professional look...', emoji: '✨' },
    { message: 'You\'re going to love this...', emoji: '💫' },
    { message: 'Making you look like the leader you are...', emoji: '👑' },
    { message: 'Your professional transformation is complete...', emoji: '🌟' },
    { message: 'This is going to change everything...', emoji: '🚀' },
    { message: 'Creating photos that command respect...', emoji: '⚡' },
  ],
  'images-combined': [
    { message: 'Blending your perfect professional elements...', emoji: '🎨' },
    { message: 'Your masterpiece is coming together...', emoji: '🖼️' },
    { message: 'Creating something truly special...', emoji: '🌟' },
    { message: 'You\'re about to see something amazing...', emoji: '✨' },
    { message: 'Building photos that tell your story...', emoji: '📖' },
    { message: 'Your professional image is taking shape...', emoji: '🚀' },
    { message: 'This is going to be your new favorite photo...', emoji: '💫' },
    { message: 'Almost ready for your wow moment...', emoji: '🎯' },
  ],
  'starting-preprocessing': [
    { message: '[1/4] Setting up your photo session...', emoji: '🚀' },
  ],
  'completed-preprocessing': [
    { message: 'Your photo is ready!', emoji: '✨' },
  ],
  'v3-preparing-assets': [
    { message: '[1/4] Preparing your brand materials...', emoji: '📦' },
  ],
  'v3-evaluating-branding': [
    { message: '[1/4] Validating logo quality...', emoji: '🔎' },
  ],
  'v3-generating-person': [
    { message: '[2/4] Creating your portrait...', emoji: '🎨' },
  ],
  'v3-generating-background': [
    { message: '[2/4] Generating your background...', emoji: '🖼️' },
  ],
  'v3-person-complete': [
    { message: '[3/4] Portrait done! Preparing the scene...', emoji: '✅' },
  ],
  'v3-preparing-composition': [
    { message: '[3/4] Composing the final photo...', emoji: '🧩' },
  ],
  'v3-compositing': [
    { message: '[3/4] Placing you in the scene...', emoji: '🤝' },
  ],
  'v3-refining': [
    { message: '[4/4] Final quality check...', emoji: '🔍' },
  ],
}

const DEFAULT_MESSAGES: ProgressMessage[] = [
  { message: 'Creating photos that boost your confidence...', emoji: '💫' },
  { message: 'Building your professional presence...', emoji: '🚀' },
  { message: 'Your transformation is almost complete...', emoji: '✨' },
  { message: 'Get ready for your professional upgrade...', emoji: '🌟' },
  { message: 'You\'re about to see something incredible...', emoji: '🎯' },
  { message: 'Your best professional photos are coming...', emoji: '📸' },
]

/**
 * Get a random message for a preprocessing step
 */
export function getProgressMessage(stepName?: string): ProgressMessage {
  if (!stepName) {
    // Return random default message
    const messages = DEFAULT_MESSAGES
    return messages[Math.floor(Math.random() * messages.length)]
  }

  const messages = STEP_MESSAGES[stepName]
  if (!messages || messages.length === 0) {
    return getProgressMessage() // Fallback to default
  }

  // Return random message from the step's messages
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Get all possible messages for a step (useful for rotation)
 */
export function getProgressMessages(stepName: string): ProgressMessage[] {
  return STEP_MESSAGES[stepName] || DEFAULT_MESSAGES
}

/**
 * Format progress message for display
 */
export function formatProgressMessage(progressMessage: ProgressMessage): string {
  if (progressMessage.emoji) {
    return `${progressMessage.emoji} ${progressMessage.message}`
  }
  return progressMessage.message
}

/**
 * Format progress message with attempt number
 * Used in worker queue to show which generation attempt is running
 * 
 * @param progressMsg - The progress message object
 * @param progress - Progress percentage (0-100)
 * @param currentAttempt - Current attempt number
 * @returns Formatted string with attempt info
 * 
 * @example
 * ```typescript
 * const msg = formatProgressWithAttempt(
 *   { message: 'Generating...', emoji: '✨' },
 *   50,
 *   2
 * )
 * // Returns: "Generation #2\n50% - ✨ Generating..."
 * ```
 */
export function formatProgressWithAttempt(
  progressMsg: ProgressMessage,
  progress: number,
  currentAttempt: number
): string {
  const formatted = formatProgressMessage(progressMsg)
  return `Generation #${currentAttempt}\n${progress}% - ${formatted}`
}
