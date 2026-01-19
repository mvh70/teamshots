import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { PRICING_CONFIG } from '@/config/pricing'
import { Result, ok, err } from '@/lib/result'
import crypto from 'crypto'

// Type for Prisma transaction client
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface UpgradeUserPlanParams {
  userId: string
  planTier: 'individual' | 'pro'
  planPeriod: 'small' | 'large' | 'seats'
  seats?: number
  assignSeatToUser?: boolean
  adminUserId: string
  adminEmail: string
  reason?: string
}

export interface UpgradeResult {
  user: {
    id: string
    email: string
    planTier: string
    planPeriod: string
  }
  team?: {
    id: string
    totalSeats: number
    creditsInPool: number
  }
  creditsGranted: number
  transactionIds: string[]
}

/**
 * Upgrade a user's plan (admin action)
 *
 * For Individual plans (small/large):
 * - Updates user's planTier and planPeriod
 * - Grants credits directly to the user's Person
 *
 * For Pro/Team plans (seats):
 * - Updates user's planTier and planPeriod
 * - Creates Team if needed
 * - Sets Team.totalSeats
 * - Grants credits to team pool (seats × 100)
 * - Optionally assigns one seat to the user
 */
export async function upgradeUserPlan(
  params: UpgradeUserPlanParams
): Promise<Result<UpgradeResult, string>> {
  const {
    userId,
    planTier,
    planPeriod,
    seats,
    assignSeatToUser = true,
    adminUserId,
    adminEmail,
    reason
  } = params

  // Validate seats for pro plan
  if (planTier === 'pro' && planPeriod === 'seats') {
    if (!seats || seats < 2) {
      return err('Pro plan requires at least 2 seats')
    }
  }

  // Validate individual plan periods
  if (planTier === 'individual' && !['small', 'large'].includes(planPeriod)) {
    return err('Individual plan requires period: small or large')
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get user with person
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          person: true,
          teams: true // Teams where user is admin
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // 2. Ensure Person record exists
      let person = user.person
      if (!person) {
        person = await tx.person.create({
          data: {
            firstName: user.email.split('@')[0],
            email: user.email,
            userId: user.id
          }
        })
      }

      // 3. Update user plan
      await tx.user.update({
        where: { id: userId },
        data: {
          planTier,
          planPeriod,
          subscriptionStatus: 'active'
        }
      })

      const transactionIds: string[] = []
      let creditsGranted = 0
      let team: { id: string; totalSeats: number } | undefined

      // 4. Handle credits based on plan type
      if (planTier === 'individual') {
        // Credits go directly to Person
        const credits = planPeriod === 'small'
          ? PRICING_CONFIG.individual.credits
          : PRICING_CONFIG.vip.credits

        const transaction = await tx.creditTransaction.create({
          data: {
            credits,
            type: 'admin_plan_upgrade',
            personId: person.id,
            planTier,
            planPeriod,
            description: `Plan upgrade to ${planTier}/${planPeriod} by ${adminEmail}${reason ? `: ${reason}` : ''}`
          }
        })

        transactionIds.push(transaction.id)
        creditsGranted = credits

      } else if (planTier === 'pro' && planPeriod === 'seats' && seats) {
        // Find existing team or create new one
        let existingTeam = user.teams[0] // User's first team where they are admin

        if (!existingTeam) {
          existingTeam = await tx.team.create({
            data: {
              name: `${user.email.split('@')[0]}'s Team`,
              adminId: user.id,
              totalSeats: seats,
              creditsPerSeat: PRICING_CONFIG.seats.creditsPerSeat
            }
          })

          // Link person to team
          await tx.person.update({
            where: { id: person.id },
            data: { teamId: existingTeam.id }
          })
        } else {
          // Update existing team seats
          await tx.team.update({
            where: { id: existingTeam.id },
            data: { totalSeats: seats }
          })
        }

        team = { id: existingTeam.id, totalSeats: seats }

        // Grant credits to team pool
        const teamCredits = seats * PRICING_CONFIG.seats.creditsPerSeat

        const teamTransaction = await tx.creditTransaction.create({
          data: {
            credits: teamCredits,
            type: 'admin_plan_upgrade',
            teamId: existingTeam.id,
            personId: person.id, // Audit: who received the upgrade
            planTier,
            planPeriod,
            seats,
            description: `Plan upgrade to Pro (${seats} seats) by ${adminEmail}${reason ? `: ${reason}` : ''}`
          }
        })

        transactionIds.push(teamTransaction.id)
        creditsGranted = teamCredits

        // 5. Assign seat to user if requested
        if (assignSeatToUser) {
          // Create TeamInvite for the user (self-assignment)
          const inviteToken = crypto.randomBytes(32).toString('hex')
          const seatCredits = PRICING_CONFIG.seats.creditsPerSeat

          const teamInvite = await tx.teamInvite.create({
            data: {
              email: user.email,
              firstName: person.firstName,
              teamId: existingTeam.id,
              token: inviteToken,
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              usedAt: new Date(), // Immediately used
              creditsAllocated: seatCredits,
              personId: person.id
            }
          })

          // Transfer credits from team pool to person (inline to avoid nested transaction)
          // Debit from team pool
          const debitTransaction = await tx.creditTransaction.create({
            data: {
              credits: -seatCredits,
              type: 'seat_assigned',
              description: `Admin seat assignment for ${user.email}`,
              teamId: existingTeam.id,
              personId: person.id,
              teamInviteId: teamInvite.id
            }
          })

          // Credit to person
          const creditTransaction = await tx.creditTransaction.create({
            data: {
              credits: seatCredits,
              type: 'seat_received',
              description: `Admin seat assignment for ${user.email}`,
              personId: person.id,
              teamInviteId: teamInvite.id,
              relatedTransactionId: debitTransaction.id
            }
          })

          transactionIds.push(debitTransaction.id)
          transactionIds.push(creditTransaction.id)
        }
      }

      // 6. Create audit record
      await tx.subscriptionChange.create({
        data: {
          userId,
          teamId: team?.id,
          planTier,
          planPeriod,
          action: 'admin_upgrade',
          effectiveDate: new Date(),
          metadata: {
            adminUserId,
            adminEmail,
            reason,
            seats,
            assignSeatToUser,
            creditsGranted
          }
        }
      })

      // Get final team balance if applicable
      let creditsInPool = 0
      if (team) {
        const poolResult = await tx.creditTransaction.aggregate({
          where: { teamId: team.id },
          _sum: { credits: true }
        })
        creditsInPool = poolResult._sum.credits || 0
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          planTier,
          planPeriod
        },
        team: team ? { ...team, creditsInPool } : undefined,
        creditsGranted,
        transactionIds
      }
    })

    Logger.info('Admin upgraded user plan', {
      adminUserId,
      adminEmail,
      targetUserId: userId,
      planTier,
      planPeriod,
      seats,
      assignSeatToUser,
      creditsGranted: result.creditsGranted,
      transactionIds: result.transactionIds
    })

    return ok(result)

  } catch (error) {
    Logger.error('Failed to upgrade user plan', {
      error: error instanceof Error ? error.message : String(error),
      params
    })
    return err(error instanceof Error ? error.message : 'Failed to upgrade user plan')
  }
}
