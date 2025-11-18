import { reserveCreditsForGeneration, getUserCreditBalance, getEffectiveTeamCreditBalance } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { UserService } from './UserService'

/**
 * Consolidated credit management service
 * Centralizes all credit validation, calculation, and reservation logic
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
    const teamId = userContext?.teamId || context.user.person?.teamId || null

    // OPTIMIZATION: Fetch both balances in parallel
    const [individualBalance, teamBalance] = await Promise.all([
      getUserCreditBalance(userId),
      teamId ? getEffectiveTeamCreditBalance(userId, teamId) : Promise.resolve(0)
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

      // Reserve credits using existing function
      // For team credits: pass personId AND teamId (both required for team credit deduction)
      // For individual credits: pass userId only (no personId, no teamId) to use getUserCreditBalance
      // Credits are tracked per person, not per invite
      const transaction = await reserveCreditsForGeneration(
        creditSourceInfo.creditSource === 'team' ? personId : null,
        creditSourceInfo.creditSource === 'team' ? null : userId,
        requiredCredits,
        `Generation reservation`,
        creditSourceInfo.creditSource === 'team' ? (creditSourceInfo.teamId || context.teamId || undefined) : undefined
      )

      // Check if transaction was created successfully
      if (transaction && transaction.id) {
        // Calculate how credits were allocated
        const effectiveTeamId = creditSourceInfo.teamId || context.teamId || null
        const finalBalances = await Promise.all([
          getUserCreditBalance(userId),
          effectiveTeamId ? getEffectiveTeamCreditBalance(userId, effectiveTeamId) : Promise.resolve(0)
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
   */
  static async getCreditBalanceSummary(userId: string, userContext?: Awaited<ReturnType<typeof UserService.getUserContext>>): Promise<{
    individual: number
    team: number
    total: number
  }> {
    // OPTIMIZATION: Use provided userContext to avoid redundant queries
    const context = userContext || await UserService.getUserRoles(userId)
    const teamId = userContext?.teamId || context.user.person?.teamId || null

    // OPTIMIZATION: Parallel balance fetching
    const [individual, team] = await Promise.all([
      getUserCreditBalance(userId),
      getEffectiveTeamCreditBalance(userId, teamId) // Always check, even if teamId is null (for pro unmigrated credits)
    ])

    return {
      individual,
      team,
      total: individual + team
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
    if (subscription?.tier === 'pro') {
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
