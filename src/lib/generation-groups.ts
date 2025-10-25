/**
 * Generation Group Utilities
 * 
 * Helper functions for working with generation groups
 */

import { prisma } from '@/lib/prisma'

/**
 * Get all generations in a group
 */
export async function getGenerationGroup(generationGroupId: string) {
  return await prisma.generation.findMany({
    where: { generationGroupId },
    orderBy: { groupIndex: 'asc' }
  })
}

/**
 * Get the original generation in a group
 */
export async function getOriginalGeneration(generationGroupId: string) {
  return await prisma.generation.findFirst({
    where: { 
      generationGroupId,
      isOriginal: true
    }
  })
}

/**
 * Get all regenerations in a group (excluding original)
 */
export async function getRegenerations(generationGroupId: string) {
  return await prisma.generation.findMany({
    where: { 
      generationGroupId,
      isOriginal: false
    },
    orderBy: { groupIndex: 'asc' }
  })
}

/**
 * Get generation group info for a specific generation
 */
export async function getGenerationGroupInfo(generationId: string) {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { generationGroupId: true }
  })

  if (!generation?.generationGroupId) {
    return null
  }

  const group = await getGenerationGroup(generation.generationGroupId)
  const original = group.find(g => g.isOriginal)
  const regenerations = group.filter(g => !g.isOriginal)

  return {
    original,
    regenerations,
    totalCount: group.length,
    groupId: generation.generationGroupId
  }
}
