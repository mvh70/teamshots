import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { Logger } from '@/lib/logger'
import { createS3Client, getS3BucketName, getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const s3 = createS3Client({ forcePathStyle: true })
const bucket = getS3BucketName()
const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 500 })

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { tempKey } = await req.json()
    if (!tempKey || typeof tempKey !== 'string' || !tempKey.startsWith('temp:')) {
      return NextResponse.json({ error: 'Invalid temp key' }, { status: 400 })
    }
    const fileName = tempKey.slice('temp:'.length)
    const filePath = path.join(BASE_DIR, fileName)

    const file = await fs.readFile(filePath)

    // Basic content type guess from extension
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase()
    const contentType = ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'image/jpeg'

    // Get person record with firstName
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, firstName: true },
    })

    if (!person) {
      return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
    }

    const firstName = sanitizeNameForS3(person.firstName || 'unknown')

    // Create selfie record first to get the ID
    // For batch uploads, mark as selected by default
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: `temp-${Date.now()}`, // Temporary key, will be updated
        uploadedByUser: session.user.id,
        selected: true, // Mark as selected by default for batch uploads
      },
    })

    // Use selfie ID as filename (relative key, without folder prefix)
    // Format: selfies/{personId}-{firstName}/{selfieId}.{ext}
    const relativeKey = `selfies/${person.id}-${firstName}/${selfie.id}.${ext}`
    const s3Key = getS3Key(relativeKey)

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: file,
      ContentType: contentType,
      Metadata: {
        uploadedBy: session.user.id,
        personId: person.id,
        originalName: fileName.substring(0, 100),
      },
    }))

    // Update the selfie record with the correct relative key
    await prisma.selfie.update({
      where: { id: selfie.id },
      data: { key: relativeKey },
    })

    // Cleanup temp
    try { await fs.unlink(filePath) } catch {}

    return NextResponse.json({ key: relativeKey, selfieId: selfie.id })
  } catch (e) {
    Logger.error('[uploads/promote] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Promote failed' }, { status: 500 })
  }
}
