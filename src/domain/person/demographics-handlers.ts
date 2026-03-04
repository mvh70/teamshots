import { prisma } from '@/lib/prisma'
import { aggregateDemographics } from '@/domain/selfie/selfieDemographics'
import { parseCsvParam, queueStaleSelfies, type AccessoriesQueueSource } from './accessories-handlers'

interface SelfieForDemographics {
  id: string
  key: string
  classification: unknown | null
}

export type DetectedGender = 'male' | 'female' | 'unknown'

export interface DemographicsResponsePayload {
  demographics: {
    gender: DetectedGender
    ageRange?: string
    ethnicity?: string
  }
  pendingReanalysisCount: number
}

async function fetchSelfiesForDemographics(
  personId: string,
  searchParams: URLSearchParams
): Promise<SelfieForDemographics[]> {
  const selfieIds = parseCsvParam(searchParams, 'selfieIds')
  const selfieKeys = parseCsvParam(searchParams, 'selfieKeys')

  if (selfieIds.length > 0) {
    return prisma.selfie.findMany({
      where: {
        personId,
        id: { in: selfieIds },
      },
      select: {
        id: true,
        key: true,
        classification: true,
      },
    })
  }

  if (selfieKeys.length > 0) {
    return prisma.selfie.findMany({
      where: {
        personId,
        key: { in: selfieKeys },
      },
      select: {
        id: true,
        key: true,
        classification: true,
      },
    })
  }

  return prisma.selfie.findMany({
    where: { personId, selected: true },
    select: {
      id: true,
      key: true,
      classification: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

function normalizeGender(value?: string): DetectedGender {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'male') return 'male'
  if (normalized === 'female') return 'female'
  return 'unknown'
}

export async function buildDemographicsResponse(
  personId: string,
  searchParams: URLSearchParams,
  queueSource: AccessoriesQueueSource,
  logPrefix: string
): Promise<DemographicsResponsePayload> {
  const selfies = await fetchSelfiesForDemographics(personId, searchParams)
  const pendingReanalysisCount = await queueStaleSelfies(selfies, queueSource, logPrefix)
  const aggregated = aggregateDemographics(selfies)

  return {
    demographics: {
      gender: normalizeGender(aggregated.gender),
      ...(aggregated.ageRange ? { ageRange: aggregated.ageRange } : {}),
      ...(aggregated.ethnicity ? { ethnicity: aggregated.ethnicity } : {}),
    },
    pendingReanalysisCount,
  }
}
