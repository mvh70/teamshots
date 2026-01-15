import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { SelfieTypeStatus, SelfieType } from '@/domain/selfie/selfie-types'
import { SELFIE_TYPE_REQUIREMENTS } from '@/domain/selfie/selfie-types'
import { classifySelfieType } from '@/domain/selfie/selfie-classifier'
import { downloadSelfieAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { s3Client, getS3BucketName } from '@/lib/s3-client'

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

    // Get all selected selfies (including unclassified)
    const selfies = await prisma.selfie.findMany({
      where: {
        personId,
        selected: true,
      },
      select: {
        id: true,
        key: true,
        selfieType: true,
        selfieTypeConfidence: true,
      },
      orderBy: { selfieTypeConfidence: 'desc' },
    })

    // Classify any unclassified selfies on-demand (lazy migration)
    const unclassifiedSelfies = selfies.filter((s) => !s.selfieType)
    if (unclassifiedSelfies.length > 0) {
      const bucketName = getS3BucketName()

      // Classify in parallel (max 3 at a time to avoid overloading)
      const classifyPromises = unclassifiedSelfies.slice(0, 3).map(async (selfie) => {
        try {
          const imageData = await downloadSelfieAsBase64({
            bucketName,
            s3Client,
            key: selfie.key,
          })

          const result = await classifySelfieType({
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
          })

          // Update the database with the classification
          await prisma.selfie.update({
            where: { id: selfie.id },
            data: {
              selfieType: result.selfieType,
              selfieTypeConfidence: result.confidence,
              personCount: result.personCount,
              isProper: result.isProper,
              improperReason: result.improperReason,
              lightingQuality: result.lightingQuality,
              lightingFeedback: result.lightingFeedback,
              backgroundQuality: result.backgroundQuality,
              backgroundFeedback: result.backgroundFeedback,
            },
          })

          // Update in-memory for status response
          selfie.selfieType = result.selfieType
          selfie.selfieTypeConfidence = result.confidence
        } catch (error) {
          console.error(`Failed to classify selfie ${selfie.id}:`, error)
          // Mark as unknown to avoid repeated classification attempts
          await prisma.selfie.update({
            where: { id: selfie.id },
            data: {
              selfieType: 'unknown',
              selfieTypeConfidence: 0,
            },
          })
          selfie.selfieType = 'unknown'
          selfie.selfieTypeConfidence = 0
        }
      })

      await Promise.all(classifyPromises)
    }

    // Build status for each required type
    const classifiedSelfies = selfies.filter((s) => s.selfieType && s.selfieType !== 'unknown')
    const status: SelfieTypeStatus[] = SELFIE_TYPE_REQUIREMENTS.map((req) => {
      // Find the best matching selfie for this type (highest confidence)
      const matchingSelfie = classifiedSelfies.find((s) => s.selfieType === req.type)

      return {
        type: req.type as SelfieType,
        captured: !!matchingSelfie,
        selfieId: matchingSelfie?.id,
        confidence: matchingSelfie?.selfieTypeConfidence || undefined,
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
