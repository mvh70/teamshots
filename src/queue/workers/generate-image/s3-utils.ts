import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getS3Key, sanitizeNameForS3 } from '@/lib/s3-client'
import { detectImageFormat, mimeTypeFromFileName } from '@/lib/image-format'

import sharp from 'sharp'
import { execFile } from 'child_process'
import { Readable } from 'stream'
import type { ReferenceImage as SelfieReference } from '@/types/generation'

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

const MAX_SELFIE_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_SELFIE_BYTES = 80 * 1024 * 1024
const MAX_SELFIE_SMALLEST_SIDE_PX = 1536
const ALLOWED_MAGICK_INPUT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)

  if (Buffer.isBuffer(body)) return body

  if (body instanceof Uint8Array) return Buffer.from(body)

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    return Buffer.from(bytes)
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  throw new Error('Unsupported S3 body type')
}

function detectImageFormatFromBase64(base64: string): { mimeType: string; extension: string } {
  const prefix = base64.substring(0, 24)
  const bytes = Buffer.from(prefix, 'base64')

  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: 'image/png', extension: 'png' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' }
  }

  return { mimeType: 'image/jpeg', extension: 'jpg' }
}

export async function downloadAssetAsBuffer({
  bucketName,
  s3Client,
  key,
}: DownloadParams): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const fullKey = getS3Key(key)
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
      })
    )

    if (!response.Body) return null
    const buffer = await streamToBuffer(response.Body)
    const fallbackMime = mimeTypeFromFileName(key)
    const mimeType = response.ContentType || fallbackMime

    return {
      buffer,
      mimeType,
    }
  } catch (error) {
    Logger.warn('Failed to download asset as buffer', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function downloadSelfieAsBase64({
  bucketName,
  s3Client,
  key,
}: DownloadParams): Promise<DownloadResult> {
  const asset = await downloadAssetAsBuffer({ bucketName, s3Client, key })
  if (!asset) {
    throw new Error('Failed to access selfie image')
  }

  if (asset.buffer.byteLength > MAX_SELFIE_BYTES) {
    throw new Error(
      `Selfie exceeds max allowed size (${Math.round(asset.buffer.byteLength / (1024 * 1024))}MB > 20MB)`
    )
  }

  return {
    mimeType: asset.mimeType,
    base64: asset.buffer.toString('base64'),
  }
}

export async function downloadAssetAsBase64({
  bucketName,
  s3Client,
  key,
}: DownloadParams): Promise<DownloadResult | null> {
  const asset = await downloadAssetAsBuffer({ bucketName, s3Client, key })
  if (!asset) return null
  return {
    mimeType: asset.mimeType,
    base64: asset.buffer.toString('base64'),
  }
}

export async function uploadGeneratedImagesToS3({
  images,
  bucketName,
  s3Client,
  personId,
  generationId,
  firstName,
}: UploadParams): Promise<string[]> {
  const uploadedKeys: string[] = []

  let resolvedFirstName = firstName ?? undefined
  if (!resolvedFirstName) {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { firstName: true },
    })
    resolvedFirstName = person?.firstName ?? 'unknown'
  }

  const sanitizedFirstName = sanitizeNameForS3(resolvedFirstName)

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    const detected = await detectImageFormat(image)
    const relativeKey = `generations/${personId}-${sanitizedFirstName}/${generationId}/variation-${index + 1}.${detected.extension}`
    const s3Key = getS3Key(relativeKey)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: image,
        ContentType: detected.mimeType,
      })
    )

    uploadedKeys.push(relativeKey)
  }

  return uploadedKeys
}

function createLimiter(concurrency: number) {
  let activeCount = 0
  const queue: Array<() => void> = []

  const next = () => {
    activeCount -= 1
    const run = queue.shift()
    if (run) run()
  }

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }

    activeCount += 1
    try {
      return await fn()
    } finally {
      next()
    }
  }
}

async function normalizeSelfieBuffer(
  inputBuffer: Buffer,
  mimeType: string,
  key: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const oriented = await sharp(inputBuffer).rotate().toBuffer({ resolveWithObject: true })
    const smallestSide = Math.min(oriented.info.width, oriented.info.height)

    let pipeline = sharp(oriented.data)
    if (smallestSide > MAX_SELFIE_SMALLEST_SIDE_PX) {
      const scale = MAX_SELFIE_SMALLEST_SIDE_PX / smallestSide
      const targetWidth = Math.max(1, Math.round(oriented.info.width * scale))
      const targetHeight = Math.max(1, Math.round(oriented.info.height * scale))
      pipeline = pipeline.resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      Logger.info('Downscaled selfie to 1.5K-smallest-side cap before reference prep', {
        key,
        originalWidth: oriented.info.width,
        originalHeight: oriented.info.height,
        resizedWidth: targetWidth,
        resizedHeight: targetHeight,
        maxSmallestSide: MAX_SELFIE_SMALLEST_SIDE_PX,
      })
    }

    const normalized = await pipeline.png().toBuffer()
    return {
      buffer: normalized,
      mimeType: 'image/png',
    }
  } catch (sharpError) {
    Logger.warn('Sharp failed to process selfie, trying ImageMagick fallback', {
      key,
      error: sharpError instanceof Error ? sharpError.message : String(sharpError),
    })

    const detected = await detectImageFormat(inputBuffer)
    const effectiveMime = mimeType || detected.mimeType

    if (!ALLOWED_MAGICK_INPUT_MIME_TYPES.has(effectiveMime)) {
      throw new Error(`Unsupported fallback format for ImageMagick: ${effectiveMime}`)
    }

    const cleaned = await new Promise<Buffer>((resolve, reject) => {
      const child = execFile(
        'magick',
        [
          '-',
          '-limit',
          'memory',
          '128MB',
          '-limit',
          'disk',
          '0',
          '-limit',
          'time',
          '30',
          '-auto-orient',
          '-strip',
          '-colorspace',
          'sRGB',
          'png:-',
        ],
        {
          encoding: 'buffer',
          maxBuffer: 50 * 1024 * 1024,
        },
        (error, stdout) => {
          if (error) {
            reject(error)
            return
          }
          resolve(stdout as unknown as Buffer)
        }
      )

      if (!child.stdin) {
        reject(new Error('Failed to open ImageMagick stdin'))
        return
      }

      child.stdin.on('error', (stdinError) => {
        Logger.warn('ImageMagick stdin error', {
          key,
          error: stdinError.message,
        })
      })

      child.stdin.write(inputBuffer)
      child.stdin.end()
    })

    return {
      buffer: cleaned,
      mimeType: 'image/png',
    }
  }
}

export async function prepareSelfies({
  bucketName,
  s3Client,
  selfieKeys,
}: {
  bucketName: string
  s3Client: S3Client
  selfieKeys: string[]
}): Promise<{
  selfieReferences: SelfieReference[]
  processedSelfies: Record<string, Buffer>
}> {
  const limit = createLimiter(2)

  let totalBytes = 0
  const results = await Promise.all(
    selfieKeys.map((key) =>
      limit(async () => {
        const selfieData = await downloadSelfieAsBase64({ bucketName, s3Client, key })
        const selfieBuffer = Buffer.from(selfieData.base64, 'base64')

        const normalized = await normalizeSelfieBuffer(selfieBuffer, selfieData.mimeType, key)

        totalBytes += normalized.buffer.byteLength
        if (totalBytes > MAX_TOTAL_SELFIE_BYTES) {
          throw new Error(
            `Total selfie upload size exceeds limit (${Math.round(totalBytes / (1024 * 1024))}MB > 80MB)`
          )
        }

        return {
          key,
          reference: {
            base64: normalized.buffer.toString('base64'),
            mimeType: normalized.mimeType,
          } satisfies SelfieReference,
          buffer: normalized.buffer,
        }
      })
    )
  )

  const selfieReferences = results.map((result) => result.reference)
  const processedSelfies: Record<string, Buffer> = {}

  for (const result of results) {
    processedSelfies[result.key] = result.buffer
  }

  return { selfieReferences, processedSelfies }
}

export { detectImageFormatFromBase64 }
