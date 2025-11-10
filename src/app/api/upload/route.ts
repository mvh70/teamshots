import { fileTypeFromBuffer } from 'file-type'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getSelfieSequence } from '@/domain/access/image-access'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createS3Client, getS3BucketName, getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'


export const runtime = 'nodejs'
const s3Client = createS3Client()
const BUCKET_NAME = getS3BucketName()

/**
 * S3 Storage Structure:
 * - Selfies: selfies/{personId}-{firstName}/{selfieId}.{ext}
 * - Processed Selfies: selfies/{personId}-{firstName}/{selfieId}-processed.{ext}
 * - Generations: generations/{personId}-{firstName}/{generationId}/variation-{i}.png
 * - Other uploads: {folder}/{personId}/{uuid}.{ext}
 */

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting
  const identifier = await getRateLimitIdentifier(request, 'upload')
  const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.window)
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Upload rate limit exceeded' }, { status: 429 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const folder = formData.get('folder') as string

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate folder
  const allowedFolders = ['backgrounds', 'selfies', 'logos', 'generations']
  if (!folder || !allowedFolders.includes(folder)) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
  }

  // Convert to buffer
  const buffer = Buffer.from(await file.arrayBuffer())

  // File size validation (5MB max)
  const MAX_FILE_SIZE = 5 * 1024 * 1024
  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  // Validate file type by CONTENT not extension
  const detectedType = await fileTypeFromBuffer(buffer)
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
  
  if (!detectedType || !allowedMimeTypes.includes(detectedType.mime)) {
    return NextResponse.json({ 
      error: 'Invalid file type. Only JPEG, PNG, and WebP images allowed.' 
    }, { status: 400 })
  }

  // OPTIMIZATION: Get person record with firstName in a single query
  const person = await prisma.person.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person record not found' }, { status: 404 })
  }

  // If selfie, create record first to get the selfie ID for the filename
  
  if (folder === 'selfies') {
    // Use firstName from the initial query (no need for second query)
    const firstName = sanitizeNameForS3(person.firstName || 'unknown')
    
    // Create selfie record first to get the ID
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: `temp-${randomUUID()}`, // Temporary key, will be updated
        uploadedByUser: session.user.id,
      },
    })
    
    // Use selfie ID as filename (relative key, without folder prefix)
    // Format: selfies/{personId}-{firstName}/{selfieId}.{ext}
    const relativeKey = `${folder}/${person.id}-${firstName}/${selfie.id}.${detectedType.ext}`
    
    // Update the selfie record with the relative key (without folder prefix)
    await prisma.selfie.update({
      where: { id: selfie.id },
      data: { key: relativeKey },
    })

    // Upload WITH folder prefix (if configured)
    const s3Key = getS3Key(relativeKey)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: detectedType.mime,
      Metadata: {
        uploadedBy: session.user.id,
        personId: person.id,
        originalName: file.name.substring(0, 100),
      },
      // NO ACL - files are private by default
    })

    await s3Client.send(command)

    // Compute sequence number after creation
    const sequenceNumber = await getSelfieSequence(person.id, selfie.id)

    return NextResponse.json({
      success: true,
      selfieId: selfie.id,
      sequenceNumber,
      message: `Selfie #${sequenceNumber} uploaded successfully`,
    })
  }
  
  // For non-selfie uploads (backgrounds, logos, etc.), use UUID
  const fileName = `${randomUUID()}.${detectedType.ext}`
  const relativeKey = `${folder}/${person.id}/${fileName}`

  // Upload WITH folder prefix (if configured)
  const s3Key = getS3Key(relativeKey)
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: detectedType.mime,
    Metadata: {
      uploadedBy: session.user.id,
      personId: person.id,
      originalName: file.name.substring(0, 100),
    },
    // NO ACL - files are private by default
  })

  await s3Client.send(command)

  // For other uploads, return signed URL (use the same s3Key with folder prefix)
  const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key })
  const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 })

  return NextResponse.json({
    success: true,
    url: signedUrl,
  })
}
