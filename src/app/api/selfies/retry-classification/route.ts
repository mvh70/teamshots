import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { classifySelfieType } from '@/domain/selfie/selfie-classifier'
import { downloadSelfieAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { s3Client, getS3BucketName } from '@/lib/s3-client'

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

    // Find selfies with null or empty string classification
    const stuckSelfies = await prisma.selfie.findMany({
      where: {
        personId: person.id,
        OR: [
          { selfieType: null },
          { selfieType: '' }
        ]
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

    Logger.info('[retry-classification] Processing stuck selfies', {
      count: stuckSelfies.length,
      userId: session.user.id,
    })

    const bucketName = getS3BucketName()
    let successful = 0
    let failed = 0

    // Process selfies in batches of 3 to avoid overwhelming the API
    const BATCH_SIZE = 3
    for (let i = 0; i < stuckSelfies.length; i += BATCH_SIZE) {
      const batch = stuckSelfies.slice(i, i + BATCH_SIZE)
      
      Logger.info('[retry-classification] Processing batch', {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: batch.length,
      })

      // Process batch in parallel
      const batchPromises = batch.map(async (selfie) => {
        try {
          // Download image
          const imageData = await downloadSelfieAsBase64({
            bucketName,
            s3Client,
            key: selfie.key,
          })

          // Classify
          const result = await classifySelfieType({
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
          })

          // Update database
          await prisma.selfie.update({
            where: { id: selfie.id },
            data: {
              selfieType: result.selfieType,
              selfieTypeConfidence: result.confidence,
              personCount: result.personCount,
              isProper: result.isProper,
              improperReason: result.improperReason,
              ...(result.isProper === false && { selected: false }),
            },
          })

          successful++
          Logger.info('[retry-classification] Successfully classified', {
            selfieId: selfie.id,
            selfieType: result.selfieType,
          })
        } catch (error) {
          failed++
          Logger.error('[retry-classification] Failed to classify', {
            selfieId: selfie.id,
            error: error instanceof Error ? error.message : String(error),
          })

          // Mark as null (keep as analyzing for manual retry)
          try {
            await prisma.selfie.update({
              where: { id: selfie.id },
              data: {
                selfieType: null,
                selfieTypeConfidence: null,
                personCount: null,
                isProper: null,
                improperReason: null,
              },
            })
          } catch {}
        }
      })

      // Wait for this batch to complete before starting the next one
      await Promise.all(batchPromises)
    }

    return NextResponse.json({
      processed: stuckSelfies.length,
      successful,
      failed,
      message: `Processed ${stuckSelfies.length} stuck selfies`,
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
