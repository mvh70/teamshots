import { prisma } from '@/lib/prisma'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Env } from '@/lib/env'

const s3Client = new S3Client({
  region: Env.string('HETZNER_S3_REGION', 'eu-central'),
  endpoint: Env.string('HETZNER_S3_ENDPOINT', ''),
  credentials: {
    accessKeyId: Env.string('HETZNER_S3_ACCESS_KEY', ''),
    secretAccessKey: Env.string('HETZNER_S3_SECRET_KEY', ''),
  },
})

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
  const index = selfies.findIndex(s => s.id === selfieId)
  return index >= 0 ? index + 1 : null
}

export async function getGenerationSequence(personId: string, generationId: string): Promise<number | null> {
  const generations = await getUserGenerations(personId)
  const index = generations.findIndex(g => g.id === generationId)
  return index >= 0 ? index + 1 : null
}

export async function getPrivateImageUrl(
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: Env.string('HETZNER_S3_BUCKET'),
    Key: s3Key,
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


