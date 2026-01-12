import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { withTeamPermission } from '@/domain/access/permissions'
import { isSeatsBasedTeam, canAddTeamMember } from '@/domain/pricing/seats'
import { transferCreditsFromTeamToPerson } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'

/**
 * POST /api/team/admin/assign-seat
 *
 * Allows team admin to assign a seat to themselves.
 * This is a one-time, irreversible action that:
 * 1. Creates a TeamInvite record for the admin
 * 2. Allocates 100 credits (10 photos) to the admin
 * 3. Increments activeSeats counter
 * 4. Admin keeps their free trial credits + gets seat credits
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }

    const { session } = permissionCheck

    // Get user locale from session for translations
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    // Get user's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                activeContext: true,
                admin: true
              }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json({
        error: getTranslation('api.errors.teamInvites.userNotInTeam', locale)
      }, { status: 400 })
    }

    const team = user.person.team

    // Verify this is a seats-based team
    const useSeatsModel = await isSeatsBasedTeam(team.id)
    if (!useSeatsModel) {
      return NextResponse.json({
        error: 'This feature is only available for seats-based teams',
        errorCode: 'NOT_SEATS_BASED_TEAM'
      }, { status: 400 })
    }

    // Check if admin has already self-assigned
    const existingSelfAssignment = await prisma.teamInvite.findFirst({
      where: {
        teamId: team.id,
        personId: user.person.id
      }
    })

    if (existingSelfAssignment) {
      return NextResponse.json({
        error: 'You have already assigned a seat to yourself',
        errorCode: 'ALREADY_SELF_ASSIGNED'
      }, { status: 400 })
    }

    // Check if team has available seats
    const seatCheck = await canAddTeamMember(team.id)
    if (!seatCheck.canAdd) {
      return NextResponse.json({
        error: getTranslation('api.errors.teamInvites.noAvailableSeats', locale, {
          current: seatCheck.currentSeats?.toString() || '0',
          total: seatCheck.totalSeats?.toString() || '0'
        }),
        errorCode: 'NO_AVAILABLE_SEATS',
        currentSeats: seatCheck.currentSeats,
        totalSeats: seatCheck.totalSeats
      }, { status: 400 })
    }

    // Fixed credits per seat
    const creditsAllocated = PRICING_CONFIG.seats.creditsPerSeat

    // Use team's active context for the assignment
    const contextToUse = team.activeContext

    if (!contextToUse) {
      return NextResponse.json({
        error: getTranslation('api.errors.teamInvites.noActiveContext', locale),
        errorCode: 'NO_ACTIVE_CONTEXT',
        helpUrl: '/app/contexts'
      }, { status: 400 })
    }

    // Create self-assignment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate a token (even though it won't be used for invite link)
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year (not really used)

      // Create TeamInvite record for admin self-assignment
      const teamInvite = await tx.teamInvite.create({
        data: {
          email: user.email,
          firstName: user.person?.firstName || 'Admin',
          teamId: team.id,
          token,
          expiresAt,
          creditsAllocated,
          personId: user.person?.id, // Link to admin's person record
          usedAt: new Date(), // Mark as "used" immediately
          contextId: contextToUse.id
        }
      })

      // Note: activeSeats is calculated dynamically from TeamInvite records
      // No need to increment a counter - avoids drift

      return { teamInvite }
    })

    // Transfer credits from team pool to admin's person (outside transaction for proper balance check)
    // This is the NEW credit model: credits are actually transferred, not just marked
    if (user.person?.id) {
      await transferCreditsFromTeamToPerson(
        team.id,
        user.person.id,
        creditsAllocated,
        result.teamInvite.id,
        'Admin seat self-assignment credits'
      )
    }

    Logger.info('Admin self-assigned seat', {
      userId: user.id,
      teamId: team.id,
      inviteId: result.teamInvite.id,
      creditsAllocated
    })

    return NextResponse.json({
      success: true,
      message: 'Seat successfully assigned to yourself',
      creditsAllocated,
      invite: {
        id: result.teamInvite.id,
        creditsAllocated: result.teamInvite.creditsAllocated
      }
    })

  } catch (error) {
    Logger.error('Error in admin self-assignment', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({
      error: getTranslation('api.errors.internalServerError', 'en')
    }, { status: 500 })
  }
}

/**
 * GET /api/team/admin/assign-seat
 *
 * Check if admin has already self-assigned a seat
 */
export async function GET(request: NextRequest) {
  try {
    const permissionCheck = await withTeamPermission(
      request,
      'team.view'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { session } = permissionCheck

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json({
        hasSelfAssigned: false,
        isSeatsBasedTeam: false
      })
    }

    const team = user.person.team
    const useSeatsModel = await isSeatsBasedTeam(team.id)

    if (!useSeatsModel) {
      return NextResponse.json({
        hasSelfAssigned: false,
        isSeatsBasedTeam: false
      })
    }

    // Check if admin has self-assigned
    const selfAssignment = await prisma.teamInvite.findFirst({
      where: {
        teamId: team.id,
        personId: user.person.id
      }
    })

    return NextResponse.json({
      hasSelfAssigned: !!selfAssignment,
      isSeatsBasedTeam: true,
      creditsAllocated: selfAssignment?.creditsAllocated || 0
    })

  } catch (error) {
    Logger.error('Error checking admin self-assignment status', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}
