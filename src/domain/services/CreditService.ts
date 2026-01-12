import { reserveCreditsForGeneration, getPersonCreditBalance, getTeamCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { UserService } from './UserService'

/**
 * Consolidated credit management service
 * Centralizes all credit validation, calculation, and reservation logic
 *
 * NEW CREDIT MODEL (simplified):
 * - Credits ALWAYS belong to a Person (personId)
 * - Team credits are a "distribution pool" - can only be assigned to people, not used directly
 * - Generation ALWAYS deducts from person's balance
 * - No more team vs individual credit source confusion
 */
export class CreditService {
  /**
   * Validate if user has sufficient credits for an operation
   *
   * SIMPLIFIED: Always checks person balance.
   * In the new model, credits must be transferred to a person before they can be used.
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
    creditSource: 'individual' | 'team'
  }> {
    // OPTIMIZATION: Use provided userContext to avoid redundant queries
    const context = userContext || await UserService.getUserContext(userId)
    const personId = context.user.person?.id || null
    const teamId = userContext?.teamId || context.user.person?.teamId || null

    // NEW MODEL: Always check person balance (credits must be transferred to person first)
    const individualBalance = personId ? await getPersonCreditBalance(personId) : 0

    // Team balance is for display/admin purposes only (shows unassigned credits in pool)
    const teamBalance = teamId ? await getTeamCreditBalance(teamId) : 0

    const hasAccess = individualBalance >= requiredCredits

    return {
      hasAccess,
      individualBalance,
      teamBalance,
      effectiveBalance: individualBalance, // Always use individual for generation
      canUseIndividual: individualBalance >= requiredCredits,
      canUseTeam: false, // Team credits can't be used directly anymore
      creditSource: 'individual' // Always individual in new model
    }
  }

  /**
   * Reserve credits for generation with comprehensive validation
   *
   * SIMPLIFIED: Always reserves from person's balance.
   * No more team vs individual distinction - credits must be on person to use.
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

      // Validate access first (always checks person balance)
      const creditCheck = await this.validateCreditAccess(userId, requiredCredits, context)
      if (!creditCheck.hasAccess) {
        return {
          success: false,
          error: 'Insufficient credits'
        }
      }

      // NEW MODEL: Always reserve from person, never pass teamId
      // Credits are transferred to person BEFORE generation (on seat assignment/invite acceptance)
      const transaction = await reserveCreditsForGeneration(
        personId,
        requiredCredits,
        `Generation reservation`
        // No teamId - always deduct from person
      )

      // Check if transaction was created successfully
      if (transaction && transaction.id) {
        return {
          success: true,
          transactionId: transaction.id,
          individualCreditsUsed: requiredCredits,
          teamCreditsUsed: 0 // Team credits never used directly
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
   *
   * Returns both person balance (usable) and team balance (assignable pool).
   * - person/individual: Credits the user can spend on generation
   * - team: Unassigned credits in team pool (admin only view)
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
    const [person, team] = await Promise.all([
      personId ? getPersonCreditBalance(personId) : Promise.resolve(0),
      teamId ? getTeamCreditBalance(teamId) : Promise.resolve(0)
    ])

    return {
      individual: person, // Usable credits (on person)
      team,               // Assignable credits (in team pool, admin view only)
      person,             // Same as individual
      total: person + team // Total across person + unassigned team pool
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
   * Determine the credit source for a user
   *
   * SIMPLIFIED: Always returns 'individual' in the new model.
   * Credits must be transferred to person before they can be used.
   * This method is kept for backward compatibility with existing code.
   */
  static async determineCreditSource(userContext: Awaited<ReturnType<typeof UserService.getUserContext>>): Promise<{
    creditSource: 'individual' | 'team'
    generationType: 'personal' | 'team'
    teamId?: string
    reason: string
  }> {
    const { teamId } = userContext

    // NEW MODEL: Always use individual credits
    // Team credits are a distribution pool, not a usage pool
    // Users must have credits transferred to their person before generation
    return {
      creditSource: 'individual',
      generationType: teamId ? 'team' : 'personal', // For tracking which team the generation belongs to
      teamId: teamId || undefined,
      reason: 'Credits always belong to person (new model)'
    }
  }
}
