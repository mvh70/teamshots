/**
 * Generation flow constants
 */

/**
 * Minimum number of selfies required to start a generation
 */
export const MIN_SELFIES_REQUIRED = 2

/**
 * Check if the user has enough selfies for generation
 * @param count - Number of selfies the user has selected
 * @returns true if the user has at least MIN_SELFIES_REQUIRED selfies
 */
export function hasEnoughSelfies(count: number): boolean {
  return count >= MIN_SELFIES_REQUIRED
}

