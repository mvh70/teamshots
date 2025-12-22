import { prisma } from '@/lib/prisma'

export interface ResolveSelfiesInput {
  personId: string
  selfieIds?: string[]
  selfieKeys?: string[]
}

export interface ResolvedSelfies {
  primarySelfie: { id: string; key: string }
  selfieS3Keys: string[]
}

export async function resolveSelfies({ personId, selfieIds, selfieKeys }: ResolveSelfiesInput): Promise<ResolvedSelfies> {
  const ids: string[] = []
  const keys: string[] = []
  if (Array.isArray(selfieIds)) ids.push(...selfieIds)
  if (Array.isArray(selfieKeys)) keys.push(...selfieKeys)

  const uniqueIds = Array.from(new Set(ids))
  const uniqueKeys = Array.from(new Set(keys))

  const selfiesById = uniqueIds.length
    ? await prisma.selfie.findMany({ where: { id: { in: uniqueIds }, personId }, select: { id: true, key: true } })
    : []
  const selfiesByKey = uniqueKeys.length
    ? await prisma.selfie.findMany({ where: { key: { in: uniqueKeys }, personId }, select: { id: true, key: true } })
    : []

  // Merge and de-duplicate by id
  const map = new Map<string, { id: string; key: string }>()
  ;[...selfiesById, ...selfiesByKey].forEach(s => map.set(s.id, s))
  const selfies = Array.from(map.values())

  if (selfies.length === 0) {
    throw new Error('Selfies not found for person')
  }

  const primarySelfie = selfies[0]
  const selfieS3Keys = selfies.map(s => s.key)

  return { primarySelfie, selfieS3Keys }
}
