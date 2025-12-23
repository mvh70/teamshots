import { prisma } from '@/lib/prisma'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3BucketName, getS3Key } from '@/lib/s3-client'

const s3Client = createS3Client()

const SELFIE_ORDER = { createdAt: 'asc' as const }
const GENERATION_ORDER = { createdAt: 'asc' as const }

export async function getUserSelfies(personId: string) {
  return await prisma.selfie.findMany({
    where: { personId },
    orderBy: SELFIE_ORDER,
  })
}

export async function getUserGenerations(personId: string) {
  return await prisma.generation.findMany({
    where: { personId },
    orderBy: GENERATION_ORDER,
  })
}

export async function getSelfieBySequence(
  personId: string,
  sequenceNumber: number
) {
  if (sequenceNumber < 1) return null
  const selfies = await getUserSelfies(personId)
  return selfies[sequenceNumber - 1] || null
}

export async function getGenerationBySequence(
  personId: string,
  sequenceNumber: number
) {
  if (sequenceNumber < 1) return null
  const generations = await getUserGenerations(personId)
  return generations[sequenceNumber - 1] || null
}

export async function getSelfieSequence(personId: string, selfieId: string): Promise<number | null> {
  const selfies = await getUserSelfies(personId)
  type Selfie = typeof selfies[number];
  const index = selfies.findIndex((s: Selfie) => s.id === selfieId)
  return index >= 0 ? index + 1 : null
}

export async function getGenerationSequence(personId: string, generationId: string): Promise<number | null> {
  const generations = await getUserGenerations(personId)
  type Generation = typeof generations[number];
  const index = generations.findIndex((g: Generation) => g.id === generationId)
  return index >= 0 ? index + 1 : null
}

// s3Key is the relative key from database (without folder prefix)
export async function getPrivateImageUrl(
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> {
  // Add folder prefix if configured
  const fullKey = getS3Key(s3Key)
  const command = new GetObjectCommand({
    Bucket: getS3BucketName(),
    Key: fullKey,
  })
  return await getSignedUrl(s3Client, command, { expiresIn })
}

export async function getPublicImageUrl(
  type: 'selfie' | 'generation',
  personId: string,
  sequenceNumber: number
): Promise<string | null> {
  if (type === 'selfie') {
    const selfie = await getSelfieBySequence(personId, sequenceNumber)
    if (!selfie?.isPublic) return null
    return getPrivateImageUrl(selfie.key, 86400)
  } else {
    const generation = await getGenerationBySequence(personId, sequenceNumber)
    if (!generation?.isPublic) return null
    const key = generation.acceptedPhotoKey || generation.generatedPhotoKeys[0]
    if (!key) return null
    return getPrivateImageUrl(key, 86400)
  }
}


