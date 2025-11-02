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
    { message: 'Giving the background some alone time...', emoji: '🧹' },
    { message: 'Removing unwanted photobombers...', emoji: '👋' },
    { message: 'Making space for the star of the show...', emoji: '✨' },
    { message: 'Cleaning up the background - no distractions allowed!', emoji: '🧼' },
  ],
  'logo-placed-on-clothing': [
    { message: 'Stitching the logo onto your outfit...', emoji: '🧵' },
    { message: 'Making sure your brand stands out...', emoji: '⭐' },
    { message: 'Adding that professional touch...', emoji: '💼' },
    { message: 'Your logo is looking sharp!', emoji: '✂️' },
  ],
  'images-combined': [
    { message: 'Mixing the perfect blend...', emoji: '🎨' },
    { message: 'Putting all the pieces together...', emoji: '🧩' },
    { message: 'Creating the ultimate composition...', emoji: '🎭' },
    { message: 'Everything is coming together beautifully!', emoji: '🌈' },
  ],
  'starting-preprocessing': [
    { message: 'Preparing your photo for magic...', emoji: '🎪' },
    { message: 'Setting up the studio...', emoji: '🎬' },
    { message: 'Getting everything ready...', emoji: '⚙️' },
  ],
  'completed-preprocessing': [
    { message: 'Photo is looking great!', emoji: '✨' },
    { message: 'Preprocessing complete!', emoji: '✅' },
  ],
}

const DEFAULT_MESSAGES: ProgressMessage[] = [
  { message: 'Working on your masterpiece...', emoji: '🎨' },
  { message: 'Generating your perfect photo...', emoji: '📸' },
  { message: 'Almost there...', emoji: '⏳' },
  { message: 'Creating something amazing...', emoji: '🌟' },
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

