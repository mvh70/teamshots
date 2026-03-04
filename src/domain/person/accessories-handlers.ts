import { prisma } from '@/lib/prisma'
import { aggregateAccessories } from '@/domain/selfie/selfieAccessories'
import { needsClassificationReanalysis } from '@/domain/selfie/selfie-types'
import { classificationQueue } from '@/lib/classification-queue'
import { Logger } from '@/lib/logger'

export type AccessoriesQueueSource = 'person-accessories' | 'team-member-accessories'

export interface SelfieForAccessories {
  id: string
  key: string
  classification: unknown | null
}

export function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key)
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function fetchSelfiesForAccessories(
  personId: string,
  searchParams: URLSearchParams
): Promise<SelfieForAccessories[]> {
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

export async function queueStaleSelfies(
  selfies: SelfieForAccessories[],
  queueSource: AccessoriesQueueSource,
  logPrefix: string
): Promise<number> {
  const staleSelfies = selfies.filter((selfie) => needsClassificationReanalysis(selfie.classification))
  const queueableSelfies = staleSelfies.filter(
    (selfie) => !classificationQueue.isAnalyzing(selfie.id) && !classificationQueue.isQueued(selfie.id)
  )

  if (queueableSelfies.length === 0) {
    return staleSelfies.length
  }

  try {
    const { queueClassificationFromS3 } = await import('@/domain/selfie/selfie-classifier')
    const { s3Client, getS3BucketName } = await import('@/lib/s3-client')
    const bucketName = getS3BucketName()

    for (const selfie of queueableSelfies) {
      queueClassificationFromS3(
        {
          selfieId: selfie.id,
          selfieKey: selfie.key,
          bucketName,
          s3Client,
        },
        queueSource
      )
    }
  } catch (error) {
    Logger.warn(`[${logPrefix}] Failed to queue stale selfie re-analysis`, {
      error: error instanceof Error ? error.message : String(error),
      selfieCount: queueableSelfies.length,
    })
  }

  return staleSelfies.length
}

export async function buildAccessoriesResponse(
  personId: string,
  searchParams: URLSearchParams,
  queueSource: AccessoriesQueueSource,
  logPrefix: string
) {
  const selfies = await fetchSelfiesForAccessories(personId, searchParams)
  const pendingReanalysisCount = await queueStaleSelfies(selfies, queueSource, logPrefix)
  const accessories = aggregateAccessories(selfies)

  return { accessories, pendingReanalysisCount }
}
