import { reserveCreditsForGeneration, getPersonCreditBalance, getTeamCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { UserService } from './UserService'

/**
 * Consolidated credit management service
 * Centralizes all credit validation, calculation, and reservation logic
 *
 * Note: Credits are stored under personId (Person is the business entity).
 * User is for authentication only. Team credits are stored under teamId.
 */
export class CreditService {
  /**
   * Validate if user has sufficient credits for an operation
   * OPTIMIZATION: Single call that handles both individual and team credits
   */
  static async validateCreditAccess(
    userId: string,
    requiredCredits: number,
    userContext?: Awaited<ReturnType<typeof UserService.getUserContext>>
  ): Promise<{
    hasAccess: boolean
    individualBalance: number
    teamBalance: number
    effectiveBalance: number
    canUseIndividual: boolean
    canUseTeam: boolean
  }> {
    // OPTIMIZATION: Use provided userContext to avoid redundant queries
    const context = userContext || await UserService.getUserRoles(userId)
    const personId = context.user.person?.id || null
    const teamId = userContext?.teamId || context.user.person?.teamId || null

    // OPTIMIZATION: Fetch both balances in parallel
    // Credits are stored under personId (Person is business entity)
    const [individualBalance, teamBalance] = await Promise.all([
      personId ? getPersonCreditBalance(personId) : Promise.resolve(0),
      teamId ? getTeamCreditBalance(teamId) : Promise.resolve(0)
    ])

    const effectiveBalance = individualBalance + teamBalance
    const hasAccess = effectiveBalance >= requiredCredits

    // Determine which credit pools can be used
    const canUseIndividual = individualBalance >= requiredCredits
    const canUseTeam = teamBalance >= requiredCredits

    return {
      hasAccess,
      individualBalance,
      teamBalance,
      effectiveBalance,
      canUseIndividual,
      canUseTeam
    }
  }

  /**
   * Reserve credits for generation with comprehensive validation
   * OPTIMIZATION: Combines validation and reservation in single transaction
   *
   * Note: Credits are always reserved using personId (Person is the business entity).
   */
  static async reserveCreditsForGeneration(
    userId: string,
    personId: string,
    requiredCredits: number,
    userContext?: Awaited<ReturnType<typeof UserService.getUserContext>>
  ): Promise<{
    success: boolean
    transactionId?: string
    error?: string
    individualCreditsUsed?: number
    teamCreditsUsed?: number
  }> {
    try {
      // OPTIMIZATION: Use provided userContext to avoid redundant queries
      const context = userContext || await UserService.getUserContext(userId)

      // Determine correct credit source using centralized logic
      const creditSourceInfo = await this.determineCreditSource(context)

      // Validate access first
      const creditCheck = await this.validateCreditAccess(userId, requiredCredits, context)
      if (!creditCheck.hasAccess) {
        return {
          success: false,
          error: 'Insufficient credits'
        }
      }

      // Reserve credits using personId (Person is the business entity)
      // For team credits: pass personId AND teamId
      // For individual credits: pass personId only
      const effectiveTeamId = creditSourceInfo.creditSource === 'team'
        ? (creditSourceInfo.teamId || context.teamId || undefined)
        : undefined

      const transaction = await reserveCreditsForGeneration(
        personId,
        requiredCredits,
        `Generation reservation`,
        effectiveTeamId
      )

      // Check if transaction was created successfully
      if (transaction && transaction.id) {
        // Calculate how credits were allocated by comparing balances
        const finalBalances = await Promise.all([
          getPersonCreditBalance(personId),
          effectiveTeamId ? getTeamCreditBalance(effectiveTeamId) : Promise.resolve(0)
        ])

        // OPTIMIZATION: Use the context data for credit allocation calculation
        const individualCreditsUsed = creditCheck.individualBalance - finalBalances[0]
        const teamCreditsUsed = creditCheck.teamBalance - finalBalances[1]

        return {
          success: true,
          transactionId: transaction.id,
          individualCreditsUsed: Math.max(0, individualCreditsUsed),
          teamCreditsUsed: Math.max(0, teamCreditsUsed)
        }
      }

      return {
        success: false,
        error: 'Failed to reserve credits'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get credit balance summary for dashboard/stats
   * OPTIMIZATION: Single call for both individual and team balances
   *
   * Note: Credits are stored under personId (Person is the business entity).
   * Individual balance = person balance (non-team credits stored under personId)
   * Team balance = credits stored under teamId
   */
  static async getCreditBalanceSummary(userId: string, userContext?: Awaited<ReturnType<typeof UserService.getUserContext>>): Promise<{
    individual: number
    team: number
    person: number
    total: number
  }> {
    // OPTIMIZATION: Use provided userContext to avoid redundant queries
    const context = userContext || await UserService.getUserRoles(userId)
    const teamId = userContext?.teamId || context.user.person?.teamId || null
    const personId = context.user.person?.id || null

    // OPTIMIZATION: Parallel balance fetching
    // All credits are now stored under personId or teamId (not userId)
    const [person, team] = await Promise.all([
      personId ? getPersonCreditBalance(personId) : Promise.resolve(0),
      teamId ? getTeamCreditBalance(teamId) : Promise.resolve(0)
    ])

    return {
      individual: person, // Individual credits are stored under personId
      team,
      person,
      total: person + team
    }
  }

  /**
   * Calculate credits needed for operation
   */
  static calculateCreditsNeeded(operation: 'generation' | 'regeneration', count: number = 1): number {
    const baseCredits = PRICING_CONFIG.credits.perGeneration
    return baseCredits * count
  }

  /**
   * Check if user can afford operation without reserving
   */
  static async canAffordOperation(userId: string, creditsNeeded: number, userContext?: Awaited<ReturnType<typeof UserService.getUserContext>>): Promise<boolean> {
    const creditCheck = await this.validateCreditAccess(userId, creditsNeeded, userContext)
    return creditCheck.hasAccess
  }

  /**
   * Determine the correct credit source for a user
   * Pro users and invited team members ALWAYS use team credits
   * Individual users ALWAYS use personal credits
   */
  static async determineCreditSource(userContext: Awaited<ReturnType<typeof UserService.getUserContext>>): Promise<{
    creditSource: 'individual' | 'team'
    generationType: 'personal' | 'team'
    teamId?: string
    reason: string
  }> {
    const { roles, subscription, teamId } = userContext

    // Pro users are team admins by definition and always use team credits
    // EXCEPTION: If they haven't created a team yet (deferred setup), they act as individuals
    if (subscription?.tier === 'pro') {
      if (!teamId) {
        return {
          creditSource: 'individual',
          generationType: 'personal',
          reason: 'Pro user without team uses personal credits'
        }
      }

      return {
        creditSource: 'team',
        generationType: 'team',
        teamId: teamId || undefined,
        reason: 'Pro users always use team credits'
      }
    }

    // Team admins always use team credits (even if not on pro subscription)
    if (roles.isTeamAdmin) {
      return {
        creditSource: 'team',
        generationType: 'team',
        teamId: teamId || undefined,
        reason: 'Team admins always use team credits'
      }
    }

    // Invited team members always use team credits
    if (roles.isTeamMember) {
      return {
        creditSource: 'team',
        generationType: 'team',
        teamId: teamId || undefined,
        reason: 'Team members always use team credits'
      }
    }

    // Individual users use personal credits
    return {
      creditSource: 'individual',
      generationType: 'personal',
      reason: 'Individual users use personal credits'
    }
  }
}
