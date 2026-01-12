import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transferCreditsFromTeamToPerson } from '@/domain/credits/credits'
import { isSeatsBasedTeam } from '@/domain/pricing/seats'
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
        },
        person: true // Include person if it exists
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }

    // For returning users (personId exists), allow through even if usedAt is set
    // They got a new token but are the same person
    if (invite.usedAt && !invite.personId) {
      return NextResponse.json({ error: 'Invite has already been used' }, { status: 410 })
    }

    // Check team size limits based on admin's plan tier
    // Note: With seats-based pricing, team size is managed by seat availability
    // VIP tier has unlimited team members

    // Check if person already exists (from previous acceptance before token reset)
    let person
    if (invite.personId && invite.person) {
      // Person already exists - reuse it (token was reset but personId was kept)
      person = invite.person
      
      // Update invite token on person if needed
      if (person.inviteToken !== token) {
        await prisma.person.update({
          where: { id: person.id },
          data: { inviteToken: token }
        })
      }
    } else {
      // Create new person record using firstName from invite
      person = await prisma.person.create({
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

      // Transfer credits from team to person (only for new persons)
      // This is the NEW credit model: credits are actually transferred, not just marked
      const useSeatsModel = await isSeatsBasedTeam(invite.teamId)

      if (useSeatsModel) {
        // Seats model: transfer credits from team pool to person
        await transferCreditsFromTeamToPerson(
          invite.teamId,
          person.id,
          invite.creditsAllocated,
          invite.id,
          `Seat credits for ${invite.email}`
        )

        // Note: activeSeats is calculated dynamically from TeamInvite records
        // No need to increment a counter - avoids drift

        Logger.info('Seat assigned on invite acceptance', {
          teamId: invite.teamId,
          personId: person.id,
          creditsTransferred: invite.creditsAllocated
        })
      } else {
        // Legacy credits model: credits were already deducted on invite creation
        // Just mark as allocated (no actual transfer needed)
        await prisma.creditTransaction.create({
          data: {
            credits: invite.creditsAllocated,
            type: 'invite_allocated',
            description: `Credits allocated from team invite to ${invite.email}`,
            personId: person.id,
            teamInviteId: invite.id
          }
        })
      }
    }

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
