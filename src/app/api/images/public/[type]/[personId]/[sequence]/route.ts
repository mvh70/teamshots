import { NextRequest, NextResponse } from 'next/server'
import { getPublicImageUrl } from '@/domain/access/image-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; personId: string; sequence: string }> }
) {
  const { type, personId, sequence } = await params

  if (type !== 'selfie' && type !== 'generation') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const sequenceNumber = parseInt(sequence)
  if (isNaN(sequenceNumber) || sequenceNumber < 1) {
    return NextResponse.json({ error: 'Invalid sequence' }, { status: 400 })
  }

  const publicUrl = await getPublicImageUrl(type, personId, sequenceNumber)

  if (!publicUrl) {
    return NextResponse.json(
      { error: 'Image not found or not public' },
      { status: 404 }
    )
  }

  // Redirect to signed URL
  return NextResponse.redirect(publicUrl)
}
