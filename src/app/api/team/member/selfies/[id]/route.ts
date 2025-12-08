import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { isSelfieUsedInGenerations } from '@/domain/selfie/usage'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const selfieId = resolvedParams.id

  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    let personId: string | null = null

    // Try team invite token first
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      select: {
        personId: true
      }
    })

    personId = invite?.personId || null

    // If not found, try mobile handoff token
    if (!personId) {
      // In development, allow expired tokens (for dev bypass)
      const isDevelopment = process.env.NODE_ENV === 'development'

      const handoffToken = await prisma.mobileHandoffToken.findFirst({
        where: isDevelopment ? {
          token
        } : {
          token,
          expiresAt: { gt: new Date() },
          absoluteExpiry: { gt: new Date() }
        },
        include: {
          person: true
        }
      })
      personId = handoffToken?.person?.id || null
    }

    if (!personId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Check if selfie exists and belongs to this person
    const selfie = await prisma.selfie.findFirst({
      where: {
        id: selfieId,
        personId: personId
      }
    })

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
    }

    // Check if selfie is used in any non-deleted generations
    const isUsed = await isSelfieUsedInGenerations(personId, selfieId, selfie.key)

    // Prevent deletion if selfie is used in any non-deleted generations
    if (isUsed) {
      return NextResponse.json({
        error: 'Cannot delete selfie that is used in a generation'
      }, { status: 400 })
    }

    // Delete from S3
    if (bucket && selfie.key) {
      try {
        const s3Key = getS3Key(selfie.key)
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key,
        })
        await s3.send(command)
        Logger.info('Deleted selfie from S3', { key: selfie.key, s3Key })
      } catch (s3Error) {
        Logger.error('Failed to delete from S3', {
          error: s3Error instanceof Error ? s3Error.message : String(s3Error),
          key: selfie.key
        })
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await prisma.selfie.delete({
      where: {
        id: selfieId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error('Error deleting selfie', {
      error: errorMessage,
      selfieId
    })
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
