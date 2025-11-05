import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { SecurityLogger } from '@/lib/security-logger'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

// S3 configuration (supports Backblaze B2, Hetzner, AWS S3, etc.)
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: generationId } = await params
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 })
    }

    // Validate the token and find the person
    const invite = await prisma.teamInvite.findFirst({
      where: { token, usedAt: { not: null } },
      include: { person: true }
    })
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!invite.person) {
      await SecurityLogger.logSuspiciousActivity(
        'unknown_user',
        'team_generation_delete_attempt_person_not_found',
        { inviteToken: token, generationId }
      )
      return NextResponse.json({ error: 'Person not found for this token' }, { status: 404 })
    }

    const person = invite.person

    // Get generation and verify ownership
    const generation = await prisma.generation.findFirst({
      where: { 
        id: generationId,
        personId: person.id 
      },
    })

    if (!generation) {
      await SecurityLogger.logSuspiciousActivity(
        person.userId || person.id,
        'team_generation_delete_attempt_not_found_or_unauthorized',
        { generationId }
      )
      return NextResponse.json({ error: 'Generation not found or access denied' }, { status: 404 })
    }

    if (generation.deleted) {
      return NextResponse.json({ error: 'Generation already deleted' }, { status: 400 })
    }

    // Delete generated images from S3
    const s3KeysToDelete = [
      ...generation.generatedPhotoKeys,
      ...(generation.acceptedPhotoKey ? [generation.acceptedPhotoKey] : [])
    ].filter(Boolean)

    for (const key of s3KeysToDelete) {
      try {
        // key is relative from database, add folder prefix if configured
        const s3Key = getS3Key(key)
        const command = new DeleteObjectCommand({ Bucket: bucket, Key: s3Key })
        await s3.send(command)
      } catch (s3Error) {
        Logger.error('Failed to delete team S3 file', { key, error: s3Error instanceof Error ? s3Error.message : String(s3Error) })
      }
    }

    // Mark generation as deleted in the database
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        status: 'deleted',
        generatedPhotoKeys: [],
        acceptedPhotoKey: null,
      },
    })

    return NextResponse.json({ success: true, message: 'Generation deleted successfully' })

  } catch (error) {
    Logger.error('Failed to delete team generation', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to delete generation' }, { status: 500 })
  }
}
