import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find and validate invite
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        company: true,
        context: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    // If invite has been used, find the person and return their data
    if (invite.usedAt) {
      const person = await prisma.person.findFirst({
        where: {
          email: invite.email,
          companyId: invite.companyId
        }
      })

      if (!person) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 })
      }

      return NextResponse.json({
        valid: true,
        invite: {
          email: invite.email,
          companyName: invite.company.name,
          creditsAllocated: invite.creditsAllocated,
          expiresAt: invite.expiresAt,
          hasActiveContext: Boolean(invite.context),
          personId: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          contextId: invite.context?.id
        }
      })
    }

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        companyName: invite.company.name,
        creditsAllocated: invite.creditsAllocated,
        expiresAt: invite.expiresAt,
        hasActiveContext: Boolean(invite.context),
        contextId: invite.context?.id
      }
    })

  } catch (error) {
    Logger.error('Error validating invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
