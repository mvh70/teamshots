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
        team: {
          include: {
            admin: true
          }
        },
        context: true,
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    // If invite has been used, return person data via relation
    if (invite.usedAt && invite.personId) {
      if (!invite.person) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 })
      }

      // Check if team admin is on free plan
      const adminPlanPeriod = (invite.team.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
      const isAdminOnFreePlan = adminPlanPeriod === 'free'

      return NextResponse.json({
        valid: true,
        invite: {
          email: invite.email,
          teamName: invite.team.name,
          creditsAllocated: invite.creditsAllocated,
          expiresAt: invite.expiresAt,
          hasActiveContext: Boolean(invite.context),
          personId: invite.person.id,
          firstName: invite.person.firstName,
          lastName: invite.person.lastName,
          contextId: invite.context?.id,
          isAdminOnFreePlan
        }
      })
    }

    // Check if team admin is on free plan
    const adminPlanPeriod = (invite.team.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
    const isAdminOnFreePlan = adminPlanPeriod === 'free'

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        teamName: invite.team.name,
        creditsAllocated: invite.creditsAllocated,
        expiresAt: invite.expiresAt,
        hasActiveContext: Boolean(invite.context),
        contextId: invite.context?.id,
        firstName: invite.firstName,
        isAdminOnFreePlan
      }
    })

  } catch (error) {
    Logger.error('Error validating invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
