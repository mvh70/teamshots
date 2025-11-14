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
    { message: 'Perfecting your background...', emoji: '🧹' },
    { message: 'Refining your photo...', emoji: '👋' },
    { message: 'Preparing your professional look...', emoji: '✨' },
    { message: 'Creating a clean, professional background...', emoji: '🧼' },
  ],
  'logo-placed-on-clothing': [
    { message: 'Adding your brand to your outfit...', emoji: '🧵' },
    { message: 'Placing your logo perfectly...', emoji: '⭐' },
    { message: 'Creating your branded look...', emoji: '💼' },
    { message: 'Your logo looks professional...', emoji: '✂️' },
  ],
  'images-combined': [
    { message: 'Blending your elements...', emoji: '🎨' },
    { message: 'Building your composition...', emoji: '🧩' },
    { message: 'Finalizing your photo...', emoji: '🎭' },
    { message: 'Your photo is coming together beautifully...', emoji: '🌈' },
  ],
  'starting-preprocessing': [
    { message: 'Preparing your photo...', emoji: '🎪' },
    { message: 'Setting up your generation...', emoji: '🎬' },
    { message: 'Getting everything ready...', emoji: '⚙️' },
    { message: 'Starting your photo creation...', emoji: '🚀' },
  ],
  'completed-preprocessing': [
    { message: 'Photo is ready...', emoji: '✨' },
    { message: 'Preprocessing complete...', emoji: '✅' },
    { message: 'Your photo looks great...', emoji: '💫' },
    { message: 'Photo preparation finished...', emoji: '🎯' },
  ],
}

const DEFAULT_MESSAGES: ProgressMessage[] = [
  { message: 'Crafting your professional photo...', emoji: '🎨' },
  { message: 'Creating your perfect image...', emoji: '📸' },
  { message: 'Almost ready...', emoji: '⏳' },
  { message: 'Making your photo amazing...', emoji: '🌟' },
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

