/**
 * Generation Status API Endpoint
 *
 * Returns the current status and data for a specific generation
 * Supports both session-based auth and extension token auth
 */

import { NextRequest, NextResponse } from 'next/server'

// Disable caching for this route - generation status changes frequently
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { requireAuth } from '@/lib/api/auth-middleware'
import { badRequest, notFound, internalError, forbidden } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { SecurityLogger } from '@/lib/security-logger'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'
import { deriveGenerationType } from '@/domain/generation/utils'
import { getExtensionAuthFromHeaders, EXTENSION_SCOPES } from '@/domain/extension'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

// S3 configuration (supports Backblaze B2, Hetzner, AWS S3, etc.)
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

/**
 * OPTIONS /api/generations/[id]
 * Handle CORS preflight requests for extension support
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = request.headers.get('origin')

  try {
    const { id: generationId } = await params

    if (!generationId) {
      return addCorsHeaders(badRequest('Generation ID is required'), origin)
    }

    // Authenticate (support both session and extension token)
    let userId: string | null = null

    // Try extension token first (X-Extension-Token header)
    const extensionAuth = await getExtensionAuthFromHeaders(
      request.headers,
      EXTENSION_SCOPES.GENERATION_CREATE
    )
    if (extensionAuth) {
      userId = extensionAuth.userId
    } else {
      // Fall back to session auth
      const authResult = await requireAuth()
      if (authResult instanceof NextResponse) {
        return addCorsHeaders(authResult, origin)
      }
      userId = authResult.userId
    }

    if (!userId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        origin
      )
    }

    // SECURITY: Get user person first to build authorization filter
    const userPerson = await prisma.person.findUnique({
      where: { userId },
      select: { id: true, teamId: true }
    })

    if (!userPerson) {
      return addCorsHeaders(notFound('User person not found'), origin)
    }

    // SECURITY: Filter generation by authorization DURING query, not after
    // This prevents fetching unauthorized data from the database
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        // Authorization filter: must be either owner OR same team
        OR: [
          { personId: userPerson.id }, // Owner
          {
            // Same team (both user and generation person must have same teamId)
            person: {
              teamId: userPerson.teamId || undefined,
              NOT: { teamId: null } // Ensure teamId is not null
            }
          }
        ]
      },
      include: {
        person: {
          include: {
            user: true,
            team: true
          }
        },
        context: true
      }
    })

    if (!generation) {
      // Log suspicious activity if generation exists but user lacks access
      const generationExists = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { id: true, personId: true }
      })

      if (generationExists) {
        await SecurityLogger.logSuspiciousActivity(
          userId,
          'unauthorized_generation_access_attempt',
          { generationId, attemptedPersonId: generationExists.personId }
        )
      }

      return addCorsHeaders(notFound('Generation not found'), origin)
    }

    // Get job status from queue if generation is still processing
    let jobStatus = null
    if (generation.status === 'pending' || generation.status === 'processing') {
      try {
        // Lazy import to avoid build-time issues
        const { imageGenerationQueue } = await import('@/queue')
        const job = await imageGenerationQueue.getJob(`gen-${generationId}`)
        if (job) {
          console.log('API: Raw job progress data:', {
            generationId,
            jobId: job.id,
            rawProgress: job.progress,
            progressType: typeof job.progress
          })
          // Handle progress as either number or object { progress: number, message?: string }
          const progressData = typeof job.progress === 'object' && job.progress !== null
            ? job.progress as { progress?: number; message?: string }
            : { progress: job.progress as number }
          jobStatus = {
            id: job.id,
            progress: typeof progressData === 'object' && 'progress' in progressData && typeof progressData.progress === 'number'
              ? progressData.progress
              : (typeof job.progress === 'number' ? job.progress : 0),
            message: typeof progressData === 'object' && 'message' in progressData && typeof progressData.message === 'string'
              ? progressData.message
              : undefined,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
          }
          console.log('API: Processed job status:', {
            generationId,
            progress: jobStatus.progress,
            message: jobStatus.message?.substring(0, 50)
          })
        } else {
          console.log('API: No job found for generation', generationId)
        }
      } catch (error) {
        Logger.warn('Failed to get job status', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    // SECURITY: Use /api/files/get for authorized access instead of signed URLs
    // This maintains server-side authorization while still being efficient with caching
    let generatedImageUrls: string[] = []
    if (generation.generatedPhotoKeys.length > 0) {
      generatedImageUrls = generation.generatedPhotoKeys.map((key: string) =>
        `/api/files/get?key=${encodeURIComponent(key)}`
      )
    }

    // Generate authorized URL for uploaded photo
    let uploadedPhotoUrl: string | null = null
    try {
      const styles = generation.styleSettings as unknown as Record<string, unknown> | null
      const inputSelfies = styles && typeof styles === 'object' ? (styles['inputSelfies'] as Record<string, unknown> | undefined) : undefined
      const keys = inputSelfies && typeof inputSelfies === 'object' ? (inputSelfies['keys'] as unknown) : undefined
      
      if (Array.isArray(keys)) {
        const validKeys = keys.filter((k): k is string => typeof k === 'string')
        if (validKeys.length > 0) {
          uploadedPhotoUrl = `/api/files/get?key=${encodeURIComponent(validKeys[0])}`
        }
      }
    } catch {
      // ignore malformed style settings
    }

    // Derive generationType from person.teamId (single source of truth)
    const derivedGenerationType = deriveGenerationType(generation.person.teamId)

    return addCorsHeaders(NextResponse.json({
      id: generation.id,
      status: generation.status,
      generationType: derivedGenerationType, // Derived from person.teamId, not stored field
      creditSource: generation.creditSource,
      creditsUsed: generation.creditsUsed,
      provider: generation.provider,

      // Images
      uploadedPhotoUrl,
      generatedImageUrls,
      acceptedPhotoKey: generation.acceptedPhotoKey,
      
      // Progress tracking
      userApproved: generation.userApproved,
      adminApproved: generation.adminApproved,
      
      // Moderation
      moderationScore: generation.moderationScore,
      moderationPassed: generation.moderationPassed,
      moderationDate: generation.moderationDate,
      
      // Error information
      errorMessage: generation.errorMessage,
      
      // Job status (if available)
      jobStatus,
      
      // Timestamps
      createdAt: generation.createdAt,
      completedAt: generation.completedAt,
      acceptedAt: generation.acceptedAt,
      updatedAt: generation.updatedAt,
      
      // Related data
      person: {
        id: generation.person.id,
        firstName: generation.person.firstName,
        lastName: generation.person.lastName,
        email: generation.person.email,
      },
      context: generation.context ? {
        id: generation.context.id,
        name: generation.context.name,
        stylePreset: (generation.context.settings as Record<string, unknown> | undefined)?.stylePreset as string | undefined,
      } : null,
    }), origin)

  } catch (error) {
    Logger.error('Failed to get generation status', { error: error instanceof Error ? error.message : String(error) })
    return addCorsHeaders(internalError('Failed to get generation status'), origin)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: generationId } = await params
    
    if (!generationId) {
      return badRequest('Generation ID is required')
    }

    // Get user session
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // Get generation with related data
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: {
        person: {
          include: {
            user: true,
            team: true
          }
        }
      }
    })

    if (!generation) {
      return notFound('Generation not found')
    }

    // Check if user is the owner of this generation
    // Team admins can only delete their own photos, not team members' photos
    const isOwner = generation.person.userId === userId

    if (!isOwner) {
      await SecurityLogger.logSuspiciousActivity(
        userId,
        'unauthorized_generation_delete_attempt',
        { generationId: generation.id, generationOwnerId: generation.person.userId }
      )
      return forbidden('Access denied. You can only delete your own photos.')
    }

    // Check if already deleted
    if (generation.deleted) {
      return badRequest('Generation already deleted')
    }

    // Delete generated images from S3
    const s3KeysToDelete = [
      ...generation.generatedPhotoKeys,
      ...(generation.acceptedPhotoKey ? [generation.acceptedPhotoKey] : [])
    ].filter(Boolean)

    Logger.info('Deleting S3 files', { keys: s3KeysToDelete })

    for (const key of s3KeysToDelete) {
      try {
        // key is relative from database, add folder prefix if configured
        const s3Key = getS3Key(key)
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key,
        })
        await s3.send(command)
        Logger.info('Deleted S3 file', { key, s3Key })
      } catch (s3Error) {
        Logger.error('Failed to delete S3 file', { key, error: s3Error instanceof Error ? s3Error.message : String(s3Error) })
        // Continue with other deletions even if one fails
      }
    }

    // Mark generation as deleted in database
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        generatedPhotoKeys: [], // Clear the generated photo keys
        acceptedPhotoKey: null, // Clear the accepted photo key
        status: 'deleted' // Update status to deleted
      }
    })

    Logger.info('Generation marked as deleted', { generationId })

    return NextResponse.json({
      success: true,
      message: 'Generation deleted successfully',
      generationId: generationId
    })

  } catch (error) {
    Logger.error('Failed to delete generation', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to delete generation')
  }
}
