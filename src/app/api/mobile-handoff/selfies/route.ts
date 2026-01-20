import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMobileHandoffToken, cleanupExpiredHandoffTokens } from '@/lib/mobile-handoff'
import { Logger } from '@/lib/logger'
import { getUsedSelfiesForPerson } from '@/domain/selfie/usage'

export const runtime = 'nodejs'

/**
 * GET /api/mobile-handoff/selfies?token=xxx
 * Get selfies for a handoff token user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Clean up expired tokens in the background (non-blocking)
    void cleanupExpiredHandoffTokens()
      .then(count => {
        if (count > 0) {
          Logger.info('Cleaned up expired mobile handoff tokens', { count })
        }
      })
      .catch(error => {
        Logger.warn('Background token cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })

    // Validate the handoff token
    const result = await validateMobileHandoffToken(token)
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error,
        code: result.code 
      }, { status: 401 })
    }

    if (!result.context.personId) {
      return NextResponse.json({ error: 'No person associated with token' }, { status: 400 })
    }

    // Get selfies for the person
    const selfies = await prisma.selfie.findMany({
      where: {
        personId: result.context.personId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        key: true,
        createdAt: true,
        userApproved: true
      }
    })

    // Get sets of used selfie IDs and keys (checks all generation types including multi-selfie)
    const { usedSelfieIds, usedSelfieKeys } = await getUsedSelfiesForPerson(result.context.personId)

    // Transform selfies to include URLs and usage info
    type Selfie = typeof selfies[number];
    const transformedSelfies = selfies.map((selfie: Selfie) => {
      // Check if selfie is used: either by ID or by key
      const used = usedSelfieIds.has(selfie.id) || usedSelfieKeys.has(selfie.key)
      return {
        id: selfie.id,
        key: selfie.key,
        url: `/api/files/get?key=${encodeURIComponent(selfie.key)}&handoffToken=${encodeURIComponent(token)}`,
        uploadedAt: selfie.createdAt.toISOString(),
        status: selfie.userApproved ? 'approved' : 'uploaded',
        used
      }
    })

    return NextResponse.json({ selfies: transformedSelfies })
  } catch (error) {
    Logger.error('Error fetching selfies via handoff', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/mobile-handoff/selfies
 * Save a selfie record for a handoff token user
 */
export async function POST(request: NextRequest) {
  try {
    const { token, selfieKey } = await request.json()

    if (!token || !selfieKey) {
      return NextResponse.json({ error: 'Missing token or selfieKey' }, { status: 400 })
    }

    // Clean up expired tokens in the background (non-blocking)
    void cleanupExpiredHandoffTokens()
      .then(count => {
        if (count > 0) {
          Logger.info('Cleaned up expired mobile handoff tokens', { count })
        }
      })
      .catch(error => {
        Logger.warn('Background token cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })

    // Validate the handoff token
    const result = await validateMobileHandoffToken(token)
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error,
        code: result.code 
      }, { status: 401 })
    }

    if (!result.context.personId) {
      return NextResponse.json({ error: 'No person associated with token' }, { status: 400 })
    }

    // Create selfie record
    const selfie = await prisma.selfie.create({
      data: {
        personId: result.context.personId,
        key: selfieKey,
        uploadedViaToken: token
      }
    })

    Logger.info('Selfie created via mobile handoff', {
      selfieId: selfie.id,
      personId: result.context.personId,
      userId: result.context.userId
    })

    // Queue classification (fire-and-forget with lazy import to avoid cold start delays)
    void (async () => {
      try {
        const { queueClassificationFromS3 } = await import('@/domain/selfie/selfie-classifier')
        const { s3Client, getS3BucketName } = await import('@/lib/s3-client')
        queueClassificationFromS3({
          selfieId: selfie.id,
          selfieKey: selfieKey,
          bucketName: getS3BucketName(),
          s3Client,
        }, 'mobile-handoff')
      } catch (err) {
        Logger.error('Failed to queue classification', {
          selfieId: selfie.id,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    })()

    return NextResponse.json({ selfie })
  } catch (error) {
    Logger.error('Error creating selfie via handoff', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

