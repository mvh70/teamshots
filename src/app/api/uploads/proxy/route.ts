import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { getRequestHeader } from '@/lib/server-headers'
import { createS3Client, getS3BucketName, getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { validateImageFileByHeader } from '@/lib/file-validation'


export const runtime = 'nodejs'
const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 500 })
  try {
    const { searchParams } = new URL(req.url)
    // Accept invite token via query or header to support token-auth uploads from invite flows
    const inviteToken = searchParams.get('token') || (await getRequestHeader('x-invite-token')) || undefined
    const contentType = (await getRequestHeader('x-file-content-type')) || 'application/octet-stream'
    const extension = (await getRequestHeader('x-file-extension')) || ''
    const keyHeader = await getRequestHeader('x-upload-key')
    const fileType = (await getRequestHeader('x-file-type')) || 'selfie' // selfie, background, logo

    // Organize files by type
    let folder = 'uploads'
    if (fileType === 'background') {
      folder = 'backgrounds'
    } else if (fileType === 'logo') {
      folder = 'logos'
    } else if (fileType === 'selfie') {
      folder = 'selfies'
    }

    // For selfies, backgrounds, and logos, include personId in the path when available
    let relativeKey: string
    if (!keyHeader && (fileType === 'selfie' || fileType === 'background' || fileType === 'logo')) {
      // Resolve person via session OR invite token
      let person: { id: string; firstName: string | null } | null = null

      if (inviteToken) {
        const invite = await prisma.teamInvite.findFirst({
          where: { token: inviteToken, usedAt: { not: null } },
          include: { person: { select: { id: true, firstName: true } } }
        })
        person = invite?.person || null
      } else {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        person = await prisma.person.findUnique({
          where: { userId: session.user.id },
          select: { id: true, firstName: true }
        })
      }

      if (!person) {
        return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
      
      if (fileType === 'selfie') {
        // Format: selfies/{personId}-{firstName}/{filename}
        const firstName = sanitizeNameForS3(person.firstName || 'unknown')
        relativeKey = `${folder}/${person.id}-${firstName}/${fileName}`
      } else {
        // Format: backgrounds/{personId}/{filename} or logos/{personId}/{filename}
        relativeKey = `${folder}/${person.id}/${fileName}`
      }
    } else {
      // Use provided keyHeader or construct standard key
      relativeKey = keyHeader || `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
    }

    const body = await req.arrayBuffer()
    // Validate file using shared utility (10MB max for this endpoint)
    const validation = validateImageFileByHeader(contentType, body.byteLength, 10 * 1024 * 1024)
    if (!validation.valid) {
      return validation.error!
    }
    
    // Add folder prefix if configured
    const s3Key = getS3Key(relativeKey)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: Buffer.from(body),
      ContentType: contentType
    })
    await s3.send(command)

    // Note: Database record creation is handled by calling endpoints (e.g., /api/team/member/selfies for invite flows)
    // This keeps the proxy focused on S3 upload only
    // Return relative key (without folder prefix) for database storage
    return NextResponse.json({ key: relativeKey })
  } catch (e) {
    Logger.error('[uploads/proxy] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}


