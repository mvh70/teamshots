import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { SelfieTypeStatus, SelfieType } from '@/domain/selfie/selfie-types'
import { SELFIE_TYPE_REQUIREMENTS, extractFromClassification } from '@/domain/selfie/selfie-types'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/selfies/type-status
 *
 * Get the current status of selfie types for the authenticated user.
 * Returns which selfie types have been captured and which are still needed.
 *
 * Response:
 * {
 *   status: [
 *     { type: 'front_view', captured: true, selfieId: '...', confidence: 0.95 },
 *     { type: 'side_view', captured: false },
 *     { type: 'full_body', captured: false }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || undefined

    // Resolve person: prioritize invite token when present
    let personId: string | null = null

    if (token) {
      // Check for team invite token
      const invite = await prisma.teamInvite.findFirst({
        where: { token, usedAt: { not: null } },
        select: { personId: true },
      })
      personId = invite?.personId || null

      // If not found, check for mobile handoff token
      if (!personId) {
        const handoffToken = await prisma.mobileHandoffToken.findFirst({
          where: {
            token,
            expiresAt: { gt: new Date() },
            absoluteExpiry: { gt: new Date() },
          },
          select: { personId: true },
        })
        personId = handoffToken?.personId || null
      }
    }

    // Fallback to session user when no valid token mapping
    if (!personId && session?.user?.id) {
      const person = await prisma.person.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      personId = person?.id || null
    }

    if (!personId) {
      return NextResponse.json({ status: getEmptyStatus() })
    }

    // Get ALL selfies for classification (not just selected)
    const allSelfies = await prisma.selfie.findMany({
      where: {
        personId,
      },
      select: {
        id: true,
        key: true,
        selected: true,
        classification: true,
      },
    })

    // Extract classification from each selfie
    const selfiesWithClassification = allSelfies.map((s) => ({
      id: s.id,
      key: s.key,
      selected: s.selected,
      ...extractFromClassification(s.classification),
    }))

    // Queue classification for ALL unclassified selfies (fire-and-forget with lazy imports)
    const unclassifiedSelfies = selfiesWithClassification.filter((s) => !s.selfieType)
    if (unclassifiedSelfies.length > 0) {
      Logger.info('[type-status] Queueing unclassified selfies', {
        count: unclassifiedSelfies.length,
      })

      // Fire-and-forget async block with lazy imports to avoid cold start delays
      void (async () => {
        try {
          const { queueClassificationFromS3 } = await import('@/domain/selfie/selfie-classifier')
          const { s3Client, getS3BucketName } = await import('@/lib/s3-client')
          const bucketName = getS3BucketName()

          // Queue each selfie for classification
          for (const selfie of unclassifiedSelfies) {
            queueClassificationFromS3({
              selfieId: selfie.id,
              selfieKey: selfie.key,
              bucketName,
              s3Client,
            }, 'type-status')
          }
        } catch (err) {
          Logger.error('[type-status] Failed to queue classifications', {
            error: err instanceof Error ? err.message : String(err)
          })
        }
      })()
    }

    // Build status using only SELECTED selfies (sorted by confidence)
    const selectedSelfies = selfiesWithClassification
      .filter((s) => s.selected)
      .sort((a, b) => (b.selfieTypeConfidence ?? 0) - (a.selfieTypeConfidence ?? 0))
    
    const classifiedSelectedSelfies = selectedSelfies.filter((s) => s.selfieType && s.selfieType !== 'unknown')
    const status: SelfieTypeStatus[] = SELFIE_TYPE_REQUIREMENTS.map((req) => {
      // Find the best matching selfie for this type (highest confidence)
      const matchingSelfie = classifiedSelectedSelfies.find((s) => s.selfieType === req.type)

      return {
        type: req.type as SelfieType,
        captured: !!matchingSelfie,
        selfieId: matchingSelfie?.id,
        confidence: matchingSelfie?.selfieTypeConfidence ?? undefined,
      }
    })

    return NextResponse.json({ status })
  } catch (error) {
    console.error('Error fetching selfie type status:', error)
    return NextResponse.json({ status: getEmptyStatus() })
  }
}

/**
 * Returns an empty status array for when no person is found
 */
function getEmptyStatus(): SelfieTypeStatus[] {
  return SELFIE_TYPE_REQUIREMENTS.map((req) => ({
    type: req.type as SelfieType,
    captured: false,
  }))
}
