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
  'v2-generating-person': [
    { message: 'Crafting your professional silhouette...', emoji: '🎨' },
    { message: 'Building you from the ground up...', emoji: '🧱' },
    { message: 'Your professional foundation is taking shape...', emoji: '🏗️' },
    { message: 'Getting your pose and style just right...', emoji: '✨' },
    { message: 'Making you look professional and approachable...', emoji: '💼' },
    { message: 'Your professional self is emerging...', emoji: '🌟' },
  ],
  'v2-preparing-background': [
    { message: 'Setting the stage for your professional debut...', emoji: '🎭' },
    { message: 'Preparing the perfect backdrop...', emoji: '🖼️' },
    { message: 'Your brand environment is coming together...', emoji: '🏢' },
    { message: 'Creating the right atmosphere for success...', emoji: '⚡' },
    { message: 'Making sure your background tells your story...', emoji: '📖' },
    { message: 'Your professional setting is almost ready...', emoji: '🎯' },
  ],
  'v2-compositing': [
    { message: 'Bringing you and your world together...', emoji: '🤝' },
    { message: 'Your professional image is becoming one...', emoji: '🔗' },
    { message: 'Merging your presence with your environment...', emoji: '🌍' },
    { message: 'This is where the magic happens...', emoji: '✨' },
    { message: 'Your complete professional picture emerges...', emoji: '🎨' },
    { message: 'Almost there - you\'re looking cohesive...', emoji: '💫' },
  ],
  'v2-refining': [
    { message: 'Adding those final personal touches...', emoji: '🔍' },
    { message: 'Making sure it\'s really you...', emoji: '👀' },
    { message: 'Your authentic self shines through...', emoji: '🌟' },
    { message: 'Perfecting the details that matter most...', emoji: '⚡' },
    { message: 'You\'re about to meet your professional twin...', emoji: '👯' },
    { message: 'Your true professional image is ready...', emoji: '🚀' },
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

