import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { classificationQueue } from '@/lib/classification-queue'
import { extractFromClassification, needsClassificationReanalysis } from '@/domain/selfie/selfie-types'
import { validateMobileHandoffToken } from '@/lib/mobile-handoff'
import { resolveInviteAccess } from '@/lib/invite-access'

export const runtime = 'nodejs'

/**
 * POST /api/selfies/retry-classification
 *
 * Retry classification for selfies that are stuck with null selfieType,
 * have failed classification, or contain legacy/outdated classification payloads.
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
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || undefined
    const handoffToken = searchParams.get('handoffToken') || undefined

    let personId: string | null = null
    let actorUserId: string | null = null

    if (handoffToken) {
      const result = await validateMobileHandoffToken(handoffToken)
      if (!result.success) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 401 })
      }
      personId = result.context.personId || null
      actorUserId = result.context.userId || null
    } else if (token) {
      const inviteAccess = await resolveInviteAccess({ token, extendExpiry: false })
      if (!inviteAccess.ok) {
        return NextResponse.json(
          { error: inviteAccess.error.message, code: inviteAccess.error.code },
          { status: inviteAccess.error.status }
        )
      }
      personId = inviteAccess.access.person.id
      actorUserId = inviteAccess.access.person.userId || null
    } else {
      const session = await auth()
      if (session?.user?.id) {
        actorUserId = session.user.id
        const person = await prisma.person.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
        personId = person?.id || null
      }
    }

    if (!personId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find selfies with null classification JSON
    const nullClassificationSelfies = await prisma.selfie.findMany({
      where: {
        personId,
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
        personId,
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

    // Also find selfies that need re-analysis due stale payload structure/metadata.
    const stalePayloadSelfies = allSelfiesWithClassification
      .filter((selfie) => needsClassificationReanalysis(selfie.classification))
      .slice(0, 10)

    // Combine and dedupe by selfie ID (limit to 20 total).
    const selfieMap = new Map<string, { id: string; key: string; classification: unknown | null }>()
    for (const selfie of [...nullClassificationSelfies, ...failedClassificationSelfies, ...stalePayloadSelfies]) {
      selfieMap.set(selfie.id, selfie)
    }
    const stuckSelfies = Array.from(selfieMap.values()).slice(0, 20)

    if (stuckSelfies.length === 0) {
      return NextResponse.json({
        processed: 0,
        successful: 0,
        failed: 0,
        message: 'No stuck, failed, or stale selfies found',
      })
    }

    Logger.info('[retry-classification] Queueing selfies for classification retry', {
      nullClassificationCount: nullClassificationSelfies.length,
      failedClassificationCount: failedClassificationSelfies.length,
      stalePayloadCount: stalePayloadSelfies.length,
      totalCount: stuckSelfies.length,
      userId: actorUserId,
      personId,
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
      stalePayload: stalePayloadSelfies.length,
      queueStatus,
      message: `Queued ${stuckSelfies.length} selfies for classification (${nullClassificationSelfies.length} null, ${failedClassificationSelfies.length} failed, ${stalePayloadSelfies.length} stale)`,
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
