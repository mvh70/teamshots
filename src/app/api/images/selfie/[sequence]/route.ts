import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSelfieBySequence, getPrivateImageUrl } from '@/domain/access/image-access'
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

  // Get user's person record
  const person = await prisma.person.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Get selfie by computed sequence (automatically checks ownership)
  const selfie = await getSelfieBySequence(person.id, sequenceNumber)

  if (!selfie) {
    return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
  }

  // Generate signed URL
  const signedUrl = await getPrivateImageUrl(selfie.key, 3600)

  return NextResponse.json({
    sequenceNumber,
    url: signedUrl,
    validated: selfie.validated,
    createdAt: selfie.createdAt,
  })
}
