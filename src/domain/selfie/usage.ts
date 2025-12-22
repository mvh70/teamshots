import { prisma } from '@/lib/prisma'

/**
 * Check which selfies are used in generations for a given person
 * Returns sets of selfie IDs and keys that are referenced in any non-deleted generation
 * 
 * Checks two places:
 * 1. uploadedPhotoKey (primary selfie)
 * 2. styleSettings.inputSelfies.keys array (for multi-selfie generations)
 */
export async function getUsedSelfiesForPerson(personId: string): Promise<{
  usedSelfieIds: Set<string>
  usedSelfieKeys: Set<string>
}> {
  // Get all non-deleted generations for this person
  const generations = await prisma.generation.findMany({
    where: {
      personId,
      deleted: false
    },
    select: {
      uploadedPhotoKey: true,
      styleSettings: true
    }
  })

  // Build sets of selfie IDs and keys that are used in generations
  const usedSelfieIds = new Set<string>()
  const usedSelfieKeys = new Set<string>()

  for (const generation of generations) {
    // Check uploadedPhotoKey (primary selfie)
    if (generation.uploadedPhotoKey) {
      usedSelfieKeys.add(generation.uploadedPhotoKey)
    }

    // Check styleSettings.inputSelfies.keys array (for multi-selfie generations)
    if (generation.styleSettings) {
      try {
        const styles = generation.styleSettings as unknown as Record<string, unknown> | null
        const inputSelfies = styles && typeof styles === 'object' ? (styles['inputSelfies'] as Record<string, unknown> | undefined) : undefined
        const keys = inputSelfies && typeof inputSelfies === 'object' ? (inputSelfies['keys'] as unknown) : undefined
        if (Array.isArray(keys)) {
          for (const key of keys) {
            if (typeof key === 'string') {
              usedSelfieKeys.add(key)
            }
          }
        }
      } catch {
        // Ignore malformed style settings
      }
    }
  }

  return { usedSelfieIds, usedSelfieKeys }
}

/**
 * Check if a specific selfie is used in any generation for a given person
 * Returns true if the selfie is referenced in any non-deleted generation
 */
export async function isSelfieUsedInGenerations(
  personId: string,
  selfieId: string,
  selfieKey: string
): Promise<boolean> {
  // Check uploadedPhotoKey first
  const directGenerations = await prisma.generation.findMany({
    where: {
      personId,
      deleted: false,
      uploadedPhotoKey: selfieKey
    },
    select: {
      id: true
    }
  })

  if (directGenerations.length > 0) {
    return true
  }

  // If not found in direct relationships, check styleSettings.inputSelfies.keys for multi-selfie generations
  const allGenerations = await prisma.generation.findMany({
    where: {
      personId,
      deleted: false
    },
    select: {
      styleSettings: true
    }
  })

  for (const generation of allGenerations) {
    if (generation.styleSettings) {
      try {
        const styles = generation.styleSettings as unknown as Record<string, unknown> | null
        const inputSelfies = styles && typeof styles === 'object' ? (styles['inputSelfies'] as Record<string, unknown> | undefined) : undefined
        const keys = inputSelfies && typeof inputSelfies === 'object' ? (inputSelfies['keys'] as unknown) : undefined
        if (Array.isArray(keys) && keys.includes(selfieKey)) {
          return true
        }
      } catch {
        // Ignore malformed style settings
      }
    }
  }

  return false
}

