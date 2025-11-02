import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allocateCreditsFromInvite } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { token, firstName, lastName } = await request.json()

    if (!token || !firstName || !lastName) {
      return NextResponse.json({ error: 'Token, first name, and last name are required' }, { status: 400 })
    }

    // Find and validate invite
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        team: {
          include: {
            activeContext: true
          }
        }
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: 'Invite has already been used' }, { status: 410 })
    }

    // Create person record
    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        email: invite.email,
        teamId: invite.teamId,
        inviteToken: token
      }
    })

    // Allocate credits to the person via credit transaction
    await allocateCreditsFromInvite(
      person.id,
      invite.id,
      invite.creditsAllocated,
      `Credits allocated from team invite to ${invite.email}`
    )

    // Mark invite as used and link to person
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { 
        usedAt: new Date(),
        personId: person.id,
        convertedUserId: null // Will be set when they sign up
      }
    })

    return NextResponse.json({
      success: true,
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        teamId: person.teamId,
        creditsAllocated: invite.creditsAllocated
      }
    })

  } catch (error) {
    Logger.error('Error accepting invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
