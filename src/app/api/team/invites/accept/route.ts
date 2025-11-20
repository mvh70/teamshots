import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allocateCreditsFromInvite } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'
import { enforceInviteRateLimitWithBlocking } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit + temporary IP block for public invite acceptance
    const rate = await enforceInviteRateLimitWithBlocking(request, 'invite.accept')
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.blocked ? 'Too many attempts from this IP. Please try again later.' : 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

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

    // Check team size limits based on admin's plan tier
    const team = invite.team
    const adminTier = (team?.adminId ? await prisma.user.findUnique({ where: { id: team.adminId }, select: { planTier: true } }) : null)?.planTier ?? null
    if (adminTier === 'proSmall') {
      // Count current team members (including admin)
      const currentMemberCount = await prisma.person.count({
        where: { teamId: team.id }
      })

      if (currentMemberCount >= 5) {
        return NextResponse.json({
          error: 'Team size limit reached. This team has reached its maximum of 5 members.',
          errorCode: 'TEAM_SIZE_LIMIT_REACHED'
        }, { status: 400 })
      }
    }
    // proLarge has no team size limit

    // Create person record using firstName from invite
    const person = await prisma.person.create({
      data: {
        firstName: invite.firstName,
        lastName: null, // No last name required for team invites
        email: invite.email,
        teamId: invite.teamId,
        inviteToken: token,
        onboardingState: JSON.stringify({
          state: 'not_started',
          completedTours: [],
          pendingTours: [],
          lastUpdated: new Date().toISOString(),
        }),
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
