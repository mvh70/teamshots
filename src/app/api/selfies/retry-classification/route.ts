import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { queueClassificationFromS3 } from '@/domain/selfie/selfie-classifier'
import { s3Client, getS3BucketName } from '@/lib/s3-client'
import { classificationQueue } from '@/lib/classification-queue'

export const runtime = 'nodejs'

/**
 * POST /api/selfies/retry-classification
 *
 * Retry classification for selfies that are stuck with null selfieType.
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
    const stuckSelfies = await prisma.selfie.findMany({
      where: {
        personId: person.id,
        classification: { equals: Prisma.DbNull },
      },
      select: {
        id: true,
        key: true,
      },
      take: 10, // Process max 10 at a time
    })

    if (stuckSelfies.length === 0) {
      return NextResponse.json({
        processed: 0,
        successful: 0,
        failed: 0,
        message: 'No stuck selfies found',
      })
    }

    Logger.info('[retry-classification] Queueing stuck selfies for classification', {
      count: stuckSelfies.length,
      userId: session.user.id,
    })

    const bucketName = getS3BucketName()

    // Queue each selfie for classification (fire-and-forget via global queue)
    for (const selfie of stuckSelfies) {
      queueClassificationFromS3({
        selfieId: selfie.id,
        selfieKey: selfie.key,
        bucketName,
        s3Client,
      }, 'retry-classification')
    }

    // Return immediately - classification runs in background via queue
    const queueStatus = classificationQueue.getStatus()
    return NextResponse.json({
      queued: stuckSelfies.length,
      queueStatus,
      message: `Queued ${stuckSelfies.length} stuck selfies for classification`,
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
