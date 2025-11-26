import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { httpFetch } from '@/lib/http'
import { getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'

import sharp from 'sharp'
import type { SelfieReference } from './evaluator'

interface DownloadParams {
  bucketName: string
  s3Client: S3Client
  key: string
}

interface DownloadResult {
  mimeType: string
  base64: string
}

interface UploadParams {
  images: Buffer[]
  bucketName: string
  s3Client: S3Client
  personId: string
  generationId: string
  firstName?: string | null
}

export async function downloadSelfieAsBase64({
  bucketName,
  s3Client,
  key
}: DownloadParams): Promise<DownloadResult> {
  try {
    const fullKey = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fullKey })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const response = await httpFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch selfie: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = key.endsWith('.png') ? 'image/png' : 'image/jpeg'

    return { mimeType, base64 }
  } catch (error) {
    Logger.error('Failed to download selfie as base64', {
      key,
      error: error instanceof Error ? error.message : String(error)
    })
    throw new Error('Failed to access selfie image')
  }
}

export async function downloadAssetAsBase64({
  bucketName,
  s3Client,
  key
}: DownloadParams): Promise<DownloadResult | null> {
  try {
    const fullKey = getS3Key(key)
    const command = new GetObjectCommand({ Bucket: bucketName, Key: fullKey })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 })
    const response = await httpFetch(url)

    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = key.endsWith('.png') ? 'image/png' : 'image/jpeg'

    return { mimeType, base64 }
  } catch (error) {
    Logger.warn('Failed to download asset as base64', {
      key,
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

export async function uploadGeneratedImagesToS3({
  images,
  bucketName,
  s3Client,
  personId,
  generationId,
  firstName
}: UploadParams): Promise<string[]> {
  const uploadedKeys: string[] = []

  let resolvedFirstName = firstName ?? undefined
  if (!resolvedFirstName) {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { firstName: true }
    })
    resolvedFirstName = person?.firstName ?? 'unknown'
  }

  const sanitizedFirstName = sanitizeNameForS3(resolvedFirstName)

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    const relativeKey = `generations/${personId}-${sanitizedFirstName}/${generationId}/variation-${index + 1}.png`
    const s3Key = getS3Key(relativeKey)

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: image,
          ContentType: 'image/png'
        })
      )
      uploadedKeys.push(relativeKey)
    } catch (error) {
      Logger.error('Failed to upload generated image', {
        index: index + 1,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`Failed to upload generated image ${index + 1}`)
    }
  }

  return uploadedKeys
}

export async function prepareSelfies({
  bucketName,
  s3Client,
  selfieKeys
}: {
  bucketName: string
  s3Client: S3Client
  selfieKeys: string[]
}): Promise<{
  selfieReferences: SelfieReference[]
  processedSelfies: Record<string, Buffer>
}> {
  const prepareSelfieReference = async (
    key: string
  ): Promise<{ reference: SelfieReference; buffer: Buffer }> => {
    const selfieData = await downloadSelfieAsBase64({ bucketName, s3Client, key })
    const selfieBuffer = Buffer.from(selfieData.base64, 'base64')

    // Rotate based on EXIF orientation (Sharp's .rotate() auto-applies EXIF orientation)
    const rotatedBuffer = await sharp(selfieBuffer).rotate().toBuffer()
    const pngBuffer = await sharp(rotatedBuffer).png().toBuffer()

    return {
      reference: {
        // No label: labels are only rendered on the composite image, not individual selfies
        base64: pngBuffer.toString('base64'),
        mimeType: 'image/png'
      },
      buffer: pngBuffer // Use PNG buffer for consistency
    }
  }

  const results = await Promise.all(
    selfieKeys.map((key) => prepareSelfieReference(key))
  )

  const selfieReferences = results.map((r) => r.reference)
  const processedSelfies: Record<string, Buffer> = {}
  selfieKeys.forEach((key, index) => {
    processedSelfies[key] = results[index].buffer
  })

  return { selfieReferences, processedSelfies }
}

