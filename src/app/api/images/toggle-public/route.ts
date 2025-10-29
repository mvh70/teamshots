import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSelfieBySequence, getGenerationBySequence } from '@/domain/access/image-access'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, sequenceNumber, isPublic } = await request.json()

  if (type !== 'selfie' && type !== 'generation') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  if (!sequenceNumber || sequenceNumber < 1) {
    return NextResponse.json({ error: 'Invalid sequence number' }, { status: 400 })
  }

  const person = await prisma.person.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Verify ownership and update
  if (type === 'selfie') {
    const selfie = await getSelfieBySequence(person.id, sequenceNumber)
    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
    }

    await prisma.selfie.update({
      where: { id: selfie.id },
      data: { isPublic },
    })
  } else {
    const generation = await getGenerationBySequence(person.id, sequenceNumber)
    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: { isPublic },
    })
  }

  return NextResponse.json({
    success: true,
    message: `${type} #${sequenceNumber} is now ${isPublic ? 'public' : 'private'}`,
  })
}
