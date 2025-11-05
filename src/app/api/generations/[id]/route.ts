/**
 * Generation Status API Endpoint
 * 
 * Returns the current status and data for a specific generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { SecurityLogger } from '@/lib/security-logger'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

// S3 configuration (supports Backblaze B2, Hetzner, AWS S3, etc.)
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: generationId } = await params
    
    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      )
    }

    // Get user session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get generation with related data
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: {
        person: {
          include: {
            user: true,
            team: true
          }
        },
        context: true,
        selfie: true
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify user has access to this generation
    const userPerson = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, teamId: true }
    })

    if (!userPerson) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }

    const isOwner = generation.personId === userPerson.id
    const isSameTeam = userPerson.teamId && generation.person.teamId === userPerson.teamId

    if (!isOwner && !isSameTeam) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'unauthorized_generation_access_attempt',
        { generationId: generation.id, generationOwnerId: generation.personId }
      )
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get job status from queue if generation is still processing
    let jobStatus = null
    if (generation.status === 'pending' || generation.status === 'processing') {
      try {
        // Lazy import to avoid build-time issues
        const { imageGenerationQueue } = await import('@/queue')
        const job = await imageGenerationQueue.getJob(`gen-${generationId}`)
        if (job) {
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
        }
      } catch (error) {
        Logger.warn('Failed to get job status', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    // Generate signed URLs for generated images if they exist
    let generatedImageUrls: string[] = []
    if (generation.generatedPhotoKeys.length > 0) {
      // TODO: Generate signed URLs for S3 objects
      // For now, return placeholder URLs
      generatedImageUrls = generation.generatedPhotoKeys.map((key: string, index: number) => 
        `/api/files/proxy?key=${encodeURIComponent(key)}&type=generated&index=${index}`
      )
    }

    // Generate signed URL for uploaded photo
    let uploadedPhotoUrl: string | null = null
    if (generation.uploadedPhotoKey) {
      uploadedPhotoUrl = `/api/files/proxy?key=${encodeURIComponent(generation.uploadedPhotoKey)}&type=uploaded`
    }

    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      generationType: generation.generationType,
      creditSource: generation.creditSource,
      creditsUsed: generation.creditsUsed,
      provider: generation.provider,
      actualCost: generation.actualCost,
      
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
        stylePreset: generation.context.stylePreset,
      } : null,
    })

  } catch (error) {
    Logger.error('Failed to get generation status', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Failed to get generation status' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: generationId } = await params
    
    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      )
    }

    // Get user session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

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
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Check if user is the owner of this generation
    // Team admins can only delete their own photos, not team members' photos
    const isOwner = generation.person.userId === session.user.id

    if (!isOwner) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'unauthorized_generation_delete_attempt',
        { generationId: generation.id, generationOwnerId: generation.person.userId }
      )
      return NextResponse.json(
        { error: 'Access denied. You can only delete your own photos.' },
        { status: 403 }
      )
    }

    // Check if already deleted
    if (generation.deleted) {
      return NextResponse.json(
        { error: 'Generation already deleted' },
        { status: 400 }
      )
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
    return NextResponse.json(
      { error: 'Failed to delete generation' },
      { status: 500 }
    )
  }
}
