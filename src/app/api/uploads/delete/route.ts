import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

const endpoint = process.env.HETZNER_S3_ENDPOINT
const bucket = process.env.HETZNER_S3_BUCKET
const accessKeyId = process.env.HETZNER_S3_ACCESS_KEY_ID || process.env.HETZNER_S3_ACCESS_KEY
const secretAccessKey = process.env.HETZNER_S3_SECRET_ACCESS_KEY || process.env.HETZNER_S3_SECRET_KEY

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error('Missing S3 configuration')
}

const s3 = new S3Client({
  endpoint,
  region: process.env.HETZNER_S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
})

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key || key === 'undefined') {
      return NextResponse.json({ error: 'Missing or invalid key parameter' }, { status: 400 })
    }

    // Verify the selfie belongs to the user
    const selfie = await prisma.selfie.findFirst({
      where: {
        key: key,
        person: {
          userId: session.user.id,
        },
      },
    })

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found or access denied' }, { status: 404 })
    }

    // Delete from S3
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
      await s3.send(command)
    } catch (s3Error) {
      console.error('Failed to delete from S3:', s3Error)
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await prisma.selfie.delete({
      where: {
        id: selfie.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete selfie error:', error)
    return NextResponse.json(
      { error: 'Failed to delete selfie' },
      { status: 500 }
    )
  }
}
