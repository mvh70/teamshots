import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { classificationQueue } from '@/lib/classification-queue'
import { extractFromClassification } from '@/domain/selfie/selfie-types'

export const runtime = 'nodejs'

/**
 * POST /api/selfies/retry-classification
 *
 * Retry classification for selfies that are stuck with null selfieType
 * or have failed classification (improperReason contains 'Classification failed').
 * This is useful for fixing selfies that failed classification due to
 * API errors, timeouts, or rate limits.
 *
 * Response:
 * {
 *   processed: number,
 *   successful: number,
 *   failed: number
 * }
 */
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get person ID
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Find selfies with null classification JSON
    const nullClassificationSelfies = await prisma.selfie.findMany({
      where: {
        personId: person.id,
        classification: { equals: Prisma.DbNull },
      },
      select: {
        id: true,
        key: true,
        classification: true,
      },
      take: 10,
    })

    // Also find selfies with failed classification (we need to filter in JS)
    const allSelfiesWithClassification = await prisma.selfie.findMany({
      where: {
        personId: person.id,
        classification: { not: Prisma.DbNull },
      },
      select: {
        id: true,
        key: true,
        classification: true,
      },
    })

    // Filter for failed classifications
    const failedClassificationSelfies = allSelfiesWithClassification
      .filter((selfie) => {
        const classification = extractFromClassification(selfie.classification)
        return classification.improperReason?.includes('Classification failed') ||
               classification.improperReason?.includes('No valid response') ||
               classification.improperReason?.includes('Failed to parse')
      })
      .slice(0, 10)

    // Combine both lists (limit to 20 total)
    const stuckSelfies = [...nullClassificationSelfies, ...failedClassificationSelfies].slice(0, 20)

    if (stuckSelfies.length === 0) {
      return NextResponse.json({
        processed: 0,
        successful: 0,
        failed: 0,
        message: 'No stuck or failed selfies found',
      })
    }

    Logger.info('[retry-classification] Queueing stuck/failed selfies for classification', {
      nullClassificationCount: nullClassificationSelfies.length,
      failedClassificationCount: failedClassificationSelfies.length,
      totalCount: stuckSelfies.length,
      userId: session.user.id,
    })

    // Queue classification with lazy imports (fire-and-forget)
    void (async () => {
      try {
        const { queueClassificationFromS3 } = await import('@/domain/selfie/selfie-classifier')
        const { s3Client, getS3BucketName } = await import('@/lib/s3-client')
        const bucketName = getS3BucketName()

        // Queue each selfie for classification
        for (const selfie of stuckSelfies) {
          queueClassificationFromS3({
            selfieId: selfie.id,
            selfieKey: selfie.key,
            bucketName,
            s3Client,
          }, 'retry-classification')
        }
      } catch (err) {
        Logger.error('[retry-classification] Failed to queue classifications', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    })()

    // Return immediately - classification runs in background via queue
    const queueStatus = classificationQueue.getStatus()
    return NextResponse.json({
      queued: stuckSelfies.length,
      nullClassification: nullClassificationSelfies.length,
      failedClassification: failedClassificationSelfies.length,
      queueStatus,
      message: `Queued ${stuckSelfies.length} selfies for classification (${nullClassificationSelfies.length} null, ${failedClassificationSelfies.length} failed)`,
    })
  } catch (error) {
    Logger.error('[retry-classification] Endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to retry classification' },
      { status: 500 }
    )
  }
}
