import { prisma } from '@/lib/prisma'

export async function getGenerationGroup(generationGroupId: string) {
  return await prisma.generation.findMany({
    where: { generationGroupId },
    orderBy: { groupIndex: 'asc' }
  })
}

export async function getOriginalGeneration(generationGroupId: string) {
  return await prisma.generation.findFirst({
    where: { 
      generationGroupId,
      isOriginal: true
    }
  })
}

export async function getRegenerations(generationGroupId: string) {
  return await prisma.generation.findMany({
    where: { 
      generationGroupId,
      isOriginal: false
    },
    orderBy: { groupIndex: 'asc' }
  })
}

export async function getGenerationGroupInfo(generationId: string) {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { generationGroupId: true }
  })

  if (!generation?.generationGroupId) {
    return null
  }

  const group = await getGenerationGroup(generation.generationGroupId)
  type GroupGeneration = typeof group[number];
  const original = group.find((g: GroupGeneration) => g.isOriginal)
  const regenerations = group.filter((g: GroupGeneration) => !g.isOriginal)

  return {
    original,
    regenerations,
    totalCount: group.length,
    groupId: generation.generationGroupId
  }
}


