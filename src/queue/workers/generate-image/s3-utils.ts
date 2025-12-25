import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { httpFetch } from '@/lib/http'
import { getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'

import sharp from 'sharp'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { SelfieReference } from './evaluator'

const execFileAsync = promisify(execFile)

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
    let selfieBuffer = Buffer.from(selfieData.base64, 'base64')

    // Try sharp first (fast path)
    try {
      const rotatedBuffer = await sharp(selfieBuffer)
        .rotate()
        .png()
        .toBuffer()

      return {
        reference: {
          base64: rotatedBuffer.toString('base64'),
          mimeType: 'image/png'
        },
        buffer: rotatedBuffer
      }
    } catch (sharpError) {
      // Sharp failed - likely corrupted metadata
      // Fall back to ImageMagick which handles corrupt files better
      Logger.warn('Sharp failed to process selfie, using ImageMagick fallback', {
        key,
        error: sharpError instanceof Error ? sharpError.message : String(sharpError)
      })

      try {
        // Use ImageMagick to clean the image
        // -auto-orient: fix rotation
        // -strip: remove all metadata
        // -colorspace sRGB: force valid colorspace
        // Note: Use 'magick' for IMv7, falls back to 'convert' for IMv6
        const magickCommand = 'magick'
        const stdout = await new Promise<Buffer>((resolve, reject) => {
          const child = execFile(magickCommand, [
            '-',  // Read from stdin
            '-auto-orient',
            '-strip',
            '-colorspace', 'sRGB',
            'png:-'  // Output PNG to stdout
          ], {
            encoding: 'buffer',
            maxBuffer: 50 * 1024 * 1024  // 50MB max
          }, (error, stdout) => {
            if (error) {
              reject(error)
            } else {
              resolve(stdout as unknown as Buffer)
            }
          })

          if (child.stdin) {
            child.stdin.write(selfieBuffer)
            child.stdin.end()
          } else {
            reject(new Error('Failed to write to ImageMagick stdin'))
          }
        })

        const cleanedBuffer = stdout as Buffer

        Logger.info('Successfully processed selfie with ImageMagick fallback', {
          key,
          originalSize: selfieBuffer.length,
          cleanedSize: cleanedBuffer.length
        })

        return {
          reference: {
            base64: cleanedBuffer.toString('base64'),
            mimeType: 'image/png'
          },
          buffer: cleanedBuffer
        }
      } catch (magickError) {
        Logger.error('ImageMagick also failed - image may be corrupted beyond recovery', {
          key,
          sharpError: sharpError instanceof Error ? sharpError.message : String(sharpError),
          magickError: magickError instanceof Error ? magickError.message : String(magickError)
        })

        throw new Error(`Failed to process selfie ${key}: ${magickError instanceof Error ? magickError.message : String(magickError)}`)
      }
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

