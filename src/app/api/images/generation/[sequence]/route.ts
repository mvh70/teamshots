import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getGenerationBySequence, getPrivateImageUrl } from '@/domain/access/image-access'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sequence: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sequence } = await params
  const sequenceNumber = parseInt(sequence)
  if (isNaN(sequenceNumber) || sequenceNumber < 1) {
    return NextResponse.json({ error: 'Invalid sequence number' }, { status: 400 })
  }

  const person = await prisma.person.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const generation = await getGenerationBySequence(person.id, sequenceNumber)

  if (!generation) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
  }

  // Generate signed URLs for all variations
  const urls = await Promise.all(
    generation.generatedPhotoKeys.map((key: string) => getPrivateImageUrl(key, 3600))
  )

  return NextResponse.json({
    sequenceNumber,
    urls,
    acceptedUrl: generation.acceptedPhotoKey 
      ? await getPrivateImageUrl(generation.acceptedPhotoKey, 3600)
      : null,
    status: generation.status,
    createdAt: generation.createdAt,
  })
}
