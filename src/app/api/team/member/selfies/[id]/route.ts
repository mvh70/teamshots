import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: selfieId } = await params
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Delete the selfie if it belongs to this person
    const selfie = await prisma.selfie.findFirst({
      where: {
        id: selfieId,
        personId: person.id
      }
    })

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
    }

    await prisma.selfie.delete({
      where: {
        id: selfieId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    Logger.error('Error deleting selfie', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
