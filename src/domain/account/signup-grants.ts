import { prisma } from '@/lib/prisma'
import { getSignupTypeFromDomain } from '@/lib/domain'
import { PRICING_CONFIG } from '@/config/pricing'
import { getDefaultPackage } from '@/config/landing-content'
import { Logger } from '@/lib/logger'

// Type for Prisma transaction client
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface SignupGrantsInput {
  userId: string
  email: string
  firstName: string
  lastName?: string | null
  domain: string | null
  /** Existing teamId if user was invited to a team */
  existingTeamId?: string | null
  /** If true, skip analytics and admin email (e.g., for OAuth where we handle it differently) */
  skipNotifications?: boolean
}

export interface SignupGrantsResult {
  success: boolean
  person: {
    id: string
    firstName: string
    lastName: string | null
  } | null
  planTier: 'individual' | 'pro'
  credits: number
  packageId: string
  teamId: string | null
  error?: string
}

/**
 * Grant signup benefits to a new user
 *
 * This is the single source of truth for new user setup:
 * - Creates Person record (if not exists)
 * - Grants free trial credits (with idempotency check)
 * - Creates SubscriptionChange record
 * - Updates User with planTier/planPeriod (if not already set)
 * - Grants default package (with idempotency check)
 *
 * Used by both email registration and OAuth signup flows.
 */
export async function grantSignupBenefits(input: SignupGrantsInput): Promise<SignupGrantsResult> {
  const { userId, email, firstName, lastName, domain, existingTeamId, skipNotifications } = input

  // Determine user type from domain
  const userType = getSignupTypeFromDomain(domain) || 'individual'
  const planTier = userType === 'team' ? 'pro' : 'individual'

  Logger.info('Signup grants determining user type', { domain, userType, planTier, existingTeamId })
  const freeCredits = userType === 'team'
    ? PRICING_CONFIG.freeTrial.pro
    : PRICING_CONFIG.freeTrial.individual
  const packageId = getDefaultPackage(domain || undefined)
  let teamId: string | null = existingTeamId || null

  try {
    const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // 1. Ensure Person record exists
      let person = await tx.person.findUnique({
        where: { userId }
      })

      if (!person) {
        // Also check by email (for invited users)
        person = await tx.person.findFirst({
          where: { email }
        })

        if (person && !person.userId) {
          // Link existing person (from invite) to user
          person = await tx.person.update({
            where: { id: person.id },
            data: {
              userId,
              firstName,
              lastName: lastName || person.lastName,
              onboardingState: JSON.stringify({
                state: 'not_started',
                completedTours: [],
                pendingTours: [],
                lastUpdated: new Date().toISOString(),
              }),
            }
          })
        } else if (!person) {
          // Create new person
          person = await tx.person.create({
            data: {
              userId,
              firstName,
              lastName: lastName || null,
              email,
              onboardingState: JSON.stringify({
                state: 'not_started',
                completedTours: [],
                pendingTours: [],
                lastUpdated: new Date().toISOString(),
              }),
            }
          })
        }
      }

      if (!person) {
        throw new Error('Failed to create or find Person record')
      }

      // 2. Handle team registration (only if team domain and not already in a team)
      if (userType === 'team' && !teamId && !person.teamId) {
        // Create team for pro user (with null name - they'll set it up later)
        const team = await tx.team.create({
          data: {
            name: null,
            adminId: userId,
            teamMembers: {
              connect: { id: person.id }
            }
          }
        })

        // Link person to team
        await tx.person.update({
          where: { id: person.id },
          data: { teamId: team.id }
        })

        // Set user role to team_admin
        await tx.user.update({
          where: { id: userId },
          data: { role: 'team_admin' }
        })

        teamId = team.id
        Logger.info('Team auto-created for pro user', { userId, teamId: team.id })
      }

      // 4. Check for existing grants (idempotency)
      const [existingFreeGrant, existingPackage] = await Promise.all([
        tx.creditTransaction.findFirst({
          where: { personId: person.id, type: 'free_grant' }
        }),
        tx.userPackage.findFirst({
          where: { userId, packageId }
        })
      ])

      // 5. Grant free trial credits (only if not already granted)
      if (!existingFreeGrant) {
        await tx.creditTransaction.create({
          data: {
            personId: person.id,
            // Do NOT set teamId - free trial credits are personal, not team pool
            credits: freeCredits,
            type: 'free_grant',
            description: 'Free trial credits',
            planTier,
            planPeriod: 'free',
          }
        })

        // Create subscription change record
        await tx.subscriptionChange.create({
          data: {
            userId,
            planTier,
            planPeriod: 'free',
            action: 'start',
          }
        })

        // Update user with plan info (only if not already set)
        await tx.user.update({
          where: { id: userId },
          data: {
            planTier,
            planPeriod: 'free',
            freeTrialGrantedAt: new Date()
          }
        })

        Logger.info('Free trial granted', { userId, credits: freeCredits, planTier })
      }

      // 6. Grant default package (only if not already granted)
      if (!existingPackage) {
        await tx.userPackage.create({
          data: {
            userId,
            packageId,
            purchasedAt: new Date()
          }
        })
        Logger.info('Package granted', { userId, packageId })
      }

      return { person }
    })

    // 7. Send notifications (analytics + admin email) unless skipped
    if (!skipNotifications) {
      try {
        const [{ captureServerEvent }, { sendAdminSignupNotificationEmail }] = await Promise.all([
          import('@/lib/analytics/server'),
          import('@/lib/email')
        ])

        const emailDomain = email.split('@')[1] ?? null

        await Promise.allSettled([
          captureServerEvent({
            event: 'user_signup',
            distinctId: userId,
            properties: {
              user_type: userType,
              email_domain: emailDomain,
              signup_method: 'oauth', // Can be overridden by caller
            },
          }),
          sendAdminSignupNotificationEmail({
            email,
            firstName,
            lastName: lastName || undefined,
            userType,
            locale: 'en',
            teamId,
            teamWebsite: null,
          })
        ])
      } catch (error) {
        // Don't fail signup if notifications fail
        Logger.error('Signup notifications failed', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    return {
      success: true,
      person: result.person ? {
        id: result.person.id,
        firstName: result.person.firstName,
        lastName: result.person.lastName,
      } : null,
      planTier,
      credits: freeCredits,
      packageId,
      teamId,
    }
  } catch (error) {
    Logger.error('Signup grants failed', { error: error instanceof Error ? error.message : String(error) })
    return {
      success: false,
      person: null,
      planTier,
      credits: freeCredits,
      packageId,
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Determine the role for a new user based on domain and existing person
 */
export function determineUserRole(domain: string | null, existingPersonWithTeam?: { teamId: string | null }): string {
  if (existingPersonWithTeam?.teamId) {
    return 'team_member'
  }
  const userType = getSignupTypeFromDomain(domain)
  return userType === 'team' ? 'team_admin' : 'user'
}

/**
 * Determine the plan tier for a new user based on domain
 */
export function determinePlanTier(domain: string | null): 'individual' | 'pro' {
  const userType = getSignupTypeFromDomain(domain)
  return userType === 'team' ? 'pro' : 'individual'
}
