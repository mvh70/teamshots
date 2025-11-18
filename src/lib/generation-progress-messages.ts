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
    { message: 'Starting your professional transformation...', emoji: '🚀' },
    { message: 'Your photo is about to get incredible...', emoji: '✨' },
    { message: 'Preparing something you\'ll want to share...', emoji: '📸' },
    { message: 'Your professional upgrade begins now...', emoji: '⚡' },
    { message: 'Get ready for your best professional photos yet...', emoji: '🌟' },
    { message: 'This is going to be worth the wait...', emoji: '⏳' },
    { message: 'Your LinkedIn transformation starts here...', emoji: '💼' },
    { message: 'Creating photos that boost your confidence...', emoji: '💫' },
  ],
  'completed-preprocessing': [
    { message: 'Your professional photos are ready...', emoji: '✨' },
    { message: 'You\'re going to love what we created...', emoji: '💫' },
    { message: 'Your transformation is complete...', emoji: '🚀' },
    { message: 'Ready for your wow moment...', emoji: '🌟' },
    { message: 'These photos are going to change everything...', emoji: '⚡' },
    { message: 'Your best professional self awaits...', emoji: '👑' },
    { message: 'You\'re about to see something incredible...', emoji: '🎯' },
    { message: 'Your professional photos are ready to impress...', emoji: '📸' },
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

