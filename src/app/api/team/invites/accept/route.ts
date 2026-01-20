import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transferCreditsFromTeamToPerson, getPersonCreditBalance } from '@/domain/credits/credits'
import { isSeatsBasedTeam, canAddTeamMember } from '@/domain/pricing/seats'
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

    // Check if person already exists (from previous acceptance before token reset, or orphaned person)
    let person
    if (invite.personId && invite.person) {
      // Person already exists linked to invite - reuse it
      person = invite.person

      // Update invite token on person if needed
      if (person.inviteToken !== token) {
        await prisma.person.update({
          where: { id: person.id },
          data: { inviteToken: token }
        })
      }
    } else {
      // Check if there's an orphaned person with this token (from a previous partial accept)
      let existingPerson = await prisma.person.findUnique({
        where: { inviteToken: token }
      })

      // Also check by email if not found by token - handles case where token was regenerated
      // but person was already created with the old token
      if (!existingPerson && invite.email) {
        existingPerson = await prisma.person.findFirst({
          where: {
            email: { equals: invite.email, mode: 'insensitive' },
            teamId: invite.teamId
          }
        })
        if (existingPerson) {
          Logger.info('Found existing person by email (token mismatch)', {
            personId: existingPerson.id,
            inviteId: invite.id,
            email: invite.email
          })
        }
      }

      if (existingPerson) {
        // Reuse existing person - this handles the case where person was created
        // but invite wasn't updated (partial failure recovery)
        person = existingPerson
        Logger.info('Reusing existing person', {
          personId: person.id,
          inviteId: invite.id,
          foundBy: person.inviteToken === token ? 'inviteToken' : 'email'
        })

        // Update the person's inviteToken to the current token
        if (person.inviteToken !== token) {
          await prisma.person.update({
            where: { id: person.id },
            data: { inviteToken: token }
          })
        }

        // Check if credits were already transferred (person has credit balance)
        const existingBalance = await getPersonCreditBalance(person.id)

        if (existingBalance === 0) {
          // Credits weren't transferred yet - do it now
          const useSeatsModel = await isSeatsBasedTeam(invite.teamId)

          if (useSeatsModel) {
            await transferCreditsFromTeamToPerson(
              invite.teamId,
              person.id,
              invite.creditsAllocated,
              invite.id,
              `Seat credits for ${invite.email} (recovery)`
            )
            Logger.info('Credits transferred on orphaned person recovery', {
              teamId: invite.teamId,
              personId: person.id,
              creditsTransferred: invite.creditsAllocated
            })
          } else {
            await prisma.creditTransaction.create({
              data: {
                credits: invite.creditsAllocated,
                type: 'invite_allocated',
                description: `Credits allocated from team invite to ${invite.email} (recovery)`,
                personId: person.id,
                teamInviteId: invite.id
              }
            })
          }
        } else {
          Logger.info('Person already has credits, skipping transfer', {
            personId: person.id,
            existingBalance
          })
        }
      } else {
        // Before creating new person, check seat availability for seats-based teams
        const useSeatsModel = await isSeatsBasedTeam(invite.teamId)
        
        if (useSeatsModel) {
          const seatCheck = await canAddTeamMember(invite.teamId)
          if (!seatCheck.canAdd) {
            Logger.warn('Invite acceptance blocked - no available seats', {
              inviteId: invite.id,
              teamId: invite.teamId,
              currentSeats: seatCheck.currentSeats,
              totalSeats: seatCheck.totalSeats,
              reason: seatCheck.reason
            })
            return NextResponse.json({
              error: seatCheck.reason || 'No available seats. Your team admin needs to purchase more seats.',
              errorCode: 'NO_AVAILABLE_SEATS',
              currentSeats: seatCheck.currentSeats,
              totalSeats: seatCheck.totalSeats
            }, { status: 400 })
          }
        }

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error('Error accepting invite', { error: errorMessage })

    // Return meaningful error messages for known cases
    if (errorMessage.includes('Insufficient team credits')) {
      // This indicates a credit pool issue - might be a data inconsistency
      // Log additional context for debugging
      Logger.error('Insufficient team credits during invite acceptance', {
        error: errorMessage
      })
      return NextResponse.json({
        error: 'Unable to complete invite acceptance. Please contact your team admin to verify seat availability.',
        errorCode: 'INSUFFICIENT_TEAM_CREDITS'
      }, { status: 400 })
    }

    if (errorMessage.includes('Unique constraint')) {
      return NextResponse.json({
        error: 'This invite has already been processed. Please try refreshing the page.',
        errorCode: 'DUPLICATE_INVITE'
      }, { status: 409 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
