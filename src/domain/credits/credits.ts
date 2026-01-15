import { prisma } from '@/lib/prisma'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { getUserSubscription } from '@/domain/subscription/subscription'

// Type for Prisma transaction client - inferred from prisma instance
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type CreditTransactionType =
  | 'purchase'
  | 'transfer_in'
  | 'transfer_out'
  | 'generation'
  | 'refund'
  | 'invite_allocated'  // @deprecated - use seat_assigned/seat_received
  | 'invite_revoked'    // @deprecated - use seat_revoked/seat_returned
  | 'seat_assigned'     // Credits deducted from team pool (assigned to member)
  | 'seat_received'     // Credits added to person (received from team)
  | 'seat_revoked'      // Credits deducted from person (on removal)
  | 'seat_returned'     // Credits returned to team pool (from removed member)

export interface CreateCreditTransactionParams {
  credits: number
  type: CreditTransactionType
  description?: string
  teamId?: string
  personId?: string
  userId?: string
  teamInviteId?: string
  relatedTransactionId?: string
}

/**
 * Create a credit transaction
 */
export async function createCreditTransaction(params: CreateCreditTransactionParams) {
  return await prisma.creditTransaction.create({
    data: {
      credits: params.credits,
      type: params.type,
      description: params.description,
      teamId: params.teamId,
      personId: params.personId,
      userId: params.userId,
      teamInviteId: params.teamInviteId,
      relatedTransactionId: params.relatedTransactionId
    }
  })
}

/**
 * Get current credit balance for a team (only credits explicitly assigned to teamId)
 * This does NOT include unmigrated pro credits on userId
 *
 * Note: Excludes 'invite_allocated' transactions because those represent internal
 * allocations FROM the team pool TO members, not new credits added to the team.
 * The actual credits come from seat_purchase or other purchase types.
 */
export async function getTeamCreditBalance(teamId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: {
      teamId,
      // Exclude invite_allocated - these are internal allocations, not new credits
      // The credits were already added via seat_purchase/purchase
      type: { notIn: ['invite_allocated'] }
    },
    _sum: { credits: true }
  })
  const balance = result._sum.credits || 0
  Logger.debug('getTeamCreditBalance', { teamId, balance })
  return balance
}

/**
 * Get effective team credit balance
 * Returns the team credit balance for the given teamId.
 *
 * Note: This simplified version no longer looks for "unmigrated pro credits" on userId.
 * All credits should be stored under personId (for individuals) or teamId (for teams).
 */
export async function getEffectiveTeamCreditBalance(userId: string, teamId?: string | null): Promise<number> {
  if (!teamId) {
    return 0
  }

  const teamBalance = await getTeamCreditBalance(teamId)

  Logger.debug('getEffectiveTeamCreditBalance', {
    userId,
    teamId,
    teamBalance
  })

  return teamBalance
}

/**
 * Get current credit balance for a person
 * For team members, this returns the remaining allocated credits (allocation - usage)
 * Credits are tracked per person, not per invite
 * For individual users, this returns their personal credit balance
 *
 * Note: All credits should be stored under personId. This function no longer
 * falls back to userId as credits now belong to Person (business entity), not User (auth).
 */
export async function getPersonCreditBalance(personId: string): Promise<number> {
  // First, check if this person has a team invite with allocation
  const invite = await prisma.teamInvite.findFirst({
    where: { personId }
  })

  // If person has a team invite, calculate remaining allocation PLUS any personal credits
  // Credits are tracked per person via CreditTransaction (single source of truth)
  if (invite) {
    // Get total allocated from transactions (single source of truth)
    const totalAllocated = await getTeamInviteTotalAllocated(invite.id)

    // Get all usage transactions for this person (generation debits and refund credits)
    const personTransactions = await prisma.creditTransaction.findMany({
      where: {
        personId,
        type: { in: ['generation', 'refund'] }
      }
    })

    // Calculate net credits used: sum of all transaction credits
    // Generation transactions are negative (debits), refund transactions are positive (credits)
    const netCreditsUsed = personTransactions.reduce((sum: number, transaction: { credits: number }) => {
      return sum - transaction.credits // Subtract because credits is negative for debits, positive for credits
    }, 0)

    // Also get personal credits (like free trial) that don't have a teamId
    // These are the person's own credits, not team credits
    const personalCredits = await prisma.creditTransaction.aggregate({
      where: {
        personId,
        teamId: null, // Only personal credits, not team credits
        type: { notIn: ['generation', 'refund'] } // Exclude usage tracking (already counted above)
      },
      _sum: { credits: true }
    })
    const personalBalance = personalCredits._sum.credits || 0

    // Return remaining: (allocation + personal credits) - net usage
    const remaining = Math.max(0, totalAllocated + personalBalance - netCreditsUsed)
    return remaining
  }

  // Return standard credit balance (sum of all person transactions)
  // All credits should be stored under personId
  // IMPORTANT: Exclude team-level credits (seat_purchase) that have teamId set
  // These credits belong to the team, personId is just for audit trail
  const result = await prisma.creditTransaction.aggregate({
    where: {
      personId,
      // Exclude team credits where personId is only for audit trail
      OR: [
        { teamId: null }, // Individual credits (no teamId)
        { type: { in: ['generation', 'refund'] } } // Usage tracking (always count)
      ]
    },
    _sum: { credits: true }
  })

  return result._sum.credits || 0
}

/**
 * Get current credit balance for a user
 * @deprecated Use getPersonCreditBalance instead. Credits belong to Person (business entity), not User (auth).
 * This function is kept for backwards compatibility during migration.
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  // First try to get balance via personId (preferred method)
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { id: true }
  })

  if (person) {
    return getPersonCreditBalance(person.id)
  }

  // Fallback to userId query for backwards compatibility
  const result = await prisma.creditTransaction.aggregate({
    where: { userId },
    _sum: { credits: true }
  })
  return result._sum.credits || 0
}

/**
 * Transfer credits from team pool to a person (for invite acceptance or admin seat assignment)
 *
 * This is the NEW credit model where:
 * - Team credits are a "distribution pool" (can't be used directly for generation)
 * - Credits must be transferred to a person before they can be used
 * - Creates two transactions: debit from team, credit to person
 *
 * @param teamId - Team to deduct credits from
 * @param personId - Person to add credits to
 * @param amount - Number of credits to transfer
 * @param teamInviteId - Optional invite ID for tracking
 * @param description - Optional description
 */
export async function transferCreditsFromTeamToPerson(
  teamId: string,
  personId: string,
  amount: number,
  teamInviteId?: string,
  description?: string
) {
  // Check team has enough credits
  const teamBalance = await getTeamCreditBalance(teamId)
  if (teamBalance < amount) {
    throw new Error(`Insufficient team credits. Team has ${teamBalance}, trying to transfer ${amount}`)
  }

  // Create both transactions atomically
  return await prisma.$transaction(async (tx) => {
    // Debit from team pool
    const debitTransaction = await tx.creditTransaction.create({
      data: {
        credits: -amount,
        type: 'seat_assigned',
        description: description || `Credits assigned to team member`,
        teamId,
        personId, // Track which person received it (audit)
        teamInviteId
      }
    })

    // Credit to person
    const creditTransaction = await tx.creditTransaction.create({
      data: {
        credits: amount,
        type: 'seat_received',
        description: description || `Credits received from team`,
        personId,
        teamInviteId,
        relatedTransactionId: debitTransaction.id
      }
    })

    Logger.info('Credits transferred from team to person', {
      teamId,
      personId,
      amount,
      teamInviteId,
      debitTransactionId: debitTransaction.id,
      creditTransactionId: creditTransaction.id
    })

    return {
      debitTransaction,
      creditTransaction
    }
  })
}

/**
 * Transfer remaining credits from a person back to team pool (for member removal)
 *
 * @param personId - Person to deduct credits from
 * @param teamId - Team to return credits to
 * @param description - Optional description
 */
export async function transferCreditsFromPersonToTeam(
  personId: string,
  teamId: string,
  description?: string
) {
  // Get person's remaining balance
  const personBalance = await getPersonCreditBalance(personId)

  if (personBalance <= 0) {
    Logger.info('No credits to transfer back to team', { personId, teamId, balance: personBalance })
    return { transferred: 0 }
  }

  // Create both transactions atomically
  return await prisma.$transaction(async (tx) => {
    // Debit from person
    const debitTransaction = await tx.creditTransaction.create({
      data: {
        credits: -personBalance,
        type: 'seat_revoked',
        description: description || `Credits returned to team on removal`,
        personId,
        teamId // Track which team received it (audit)
      }
    })

    // Credit back to team pool
    const creditTransaction = await tx.creditTransaction.create({
      data: {
        credits: personBalance,
        type: 'seat_returned',
        description: description || `Credits returned from removed member`,
        teamId,
        personId, // Track which person it came from (audit)
        relatedTransactionId: debitTransaction.id
      }
    })

    Logger.info('Credits transferred from person back to team', {
      personId,
      teamId,
      amount: personBalance,
      debitTransactionId: debitTransaction.id,
      creditTransactionId: creditTransaction.id
    })

    return {
      transferred: personBalance,
      debitTransaction,
      creditTransaction
    }
  })
}

/**
 * Allocate credits to a person from an invite
 * @deprecated Use transferCreditsFromTeamToPerson instead
 *
 * This legacy function only creates an allocation marker without transferring credits.
 * The new model requires actual transfer from team to person.
 */
export async function allocateCreditsFromInvite(
  personId: string,
  teamInviteId: string,
  amount: number,
  description?: string
) {
  return await createCreditTransaction({
    credits: amount,
    type: 'invite_allocated',
    description: description || `Credits allocated from team invite`,
    personId,
    teamInviteId
  })
}

/**
 * Migrate pro-tier credits from user to team when team is created
 * This moves credits that were assigned to userId (personal pro credits) to teamId (team credits)
 */
export async function migrateProCreditsToTeam(userId: string, teamId: string): Promise<number> {
  // Find all pro-tier credits assigned to the user that don't have a teamId
  const userProCredits = await prisma.creditTransaction.findMany({
    where: {
      userId: userId,
      planTier: 'pro',
      teamId: null,
      credits: { gt: 0 } // Only positive credits (not debits)
    }
  })

  if (userProCredits.length === 0) {
    return 0
  }

  // Calculate total credits to migrate
  type CreditTransaction = typeof userProCredits[number];
  const totalCredits = userProCredits.reduce((sum: number, tx: CreditTransaction) => sum + tx.credits, 0)

  // Migrate each transaction by updating teamId
  // We keep the userId for audit trail, but add teamId
  await prisma.$transaction(
    userProCredits.map((tx: CreditTransaction) =>
      prisma.creditTransaction.update({
        where: { id: tx.id },
        data: { teamId: teamId }
      })
    )
  )

  Logger.info('Migrated pro credits to team', {
    userId,
    teamId,
    transactionCount: userProCredits.length,
    totalCredits
  })

  return totalCredits
}

/**
 * Use credits for generation
 * Credits are always deducted from personId (Person is the business entity that owns credits)
 */
export async function useCreditsForGeneration(
  personId: string,
  amount: number,
  description?: string
) {
  if (!personId) {
    throw new Error('personId is required - credits belong to Person, not User')
  }

  return await createCreditTransaction({
    credits: -amount,
    type: 'generation',
    description: description || `Used for photo generation`,
    personId: personId
  })
}

/**
 * Reserve credits for a generation (deduct immediately)
 * SECURITY: Wraps balance check and credit deduction in atomic transaction
 * to prevent race condition where two concurrent requests could both check
 * sufficient balance and both deduct, causing overdraft
 *
 * Credits are always associated with personId (Person is the business entity).
 * For team usage, teamId is also set to track team-level balance.
 */
export async function reserveCreditsForGeneration(
  personId: string,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  teamId?: string,
  teamInviteId?: string
) {
  if (!personId) {
    throw new Error('personId is required - credits belong to Person, not User')
  }

  // SECURITY: Use transaction with Serializable isolation to prevent race conditions
  // This ensures balance check + deduction happens atomically
  return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // For team members, deduct from team AND track person usage
    if (teamId) {
      // Calculate team balance within transaction (use aggregate for atomic read)
      const teamBalanceResult = await tx.creditTransaction.aggregate({
        where: { teamId },
        _sum: { credits: true }
      })
      const totalBalance = teamBalanceResult._sum.credits || 0

      Logger.debug('Credit validation (in transaction)', { teamId, personId, balance: totalBalance, required: amount })

      if (totalBalance < amount) {
        throw new Error(`Insufficient team credits. Available: ${totalBalance}, Required: ${amount}`)
      }

      // Create transaction that deducts from team AND tracks person usage
      return await tx.creditTransaction.create({
        data: {
          credits: -amount,
          type: 'generation',
          description: description || `Reserved for photo generation`,
          teamId: teamId,
          personId: personId, // Track which person used it
          teamInviteId: teamInviteId
        }
      })
    }

    // For individual users, use personal credits
    // Calculate balance within transaction for atomic read
    let balance: number

    // Person balance calculation
    const invite = await tx.teamInvite.findFirst({
      where: { personId }
    })

    if (invite) {
      // Calculate allocated credits from team invite
      const allocatedResult = await tx.creditTransaction.aggregate({
        where: {
          teamInviteId: invite.id,
          type: 'invite_allocated'
        },
        _sum: { credits: true }
      })
      const totalAllocated = allocatedResult._sum.credits || 0

      // Calculate net usage
      const usageTransactions = await tx.creditTransaction.findMany({
        where: {
          personId,
          type: { in: ['generation', 'refund'] }
        },
        select: { credits: true }
      })
      type UsageTransaction = typeof usageTransactions[number];
      const netCreditsUsed = usageTransactions.reduce((sum: number, t: UsageTransaction) => sum - t.credits, 0)

      // Also get personal credits (like free trial) that don't have a teamId
      // These are the person's own credits, not team credits
      const personalCredits = await tx.creditTransaction.aggregate({
        where: {
          personId,
          teamId: null, // Only personal credits, not team credits
          type: { notIn: ['generation', 'refund'] } // Exclude usage tracking (already counted above)
        },
        _sum: { credits: true }
      })
      const personalBalance = personalCredits._sum.credits || 0

      // Balance = allocation + personal credits - net usage
      balance = Math.max(0, totalAllocated + personalBalance - netCreditsUsed)
    } else {
      // Standard balance - all credits stored under personId
      const balanceResult = await tx.creditTransaction.aggregate({
        where: { personId },
        _sum: { credits: true }
      })
      balance = balanceResult._sum.credits || 0
    }

    Logger.debug('Credit validation (in transaction)', { personId, balance, required: amount })

    if (balance < amount) {
      throw new Error(`Insufficient credits. Available: ${balance}, Required: ${amount}`)
    }

    return await tx.creditTransaction.create({
      data: {
        credits: -amount,
        type: 'generation',
        description: description || `Reserved for photo generation`,
        personId: personId,
        teamId: teamId || undefined,
        teamInviteId: teamInviteId
      }
    })
  }, {
    // Serializable isolation prevents phantom reads and ensures atomicity
    isolationLevel: 'Serializable',
    // Increase timeout for complex credit calculations
    timeout: 10000 // 10 seconds
  })
}

/**
 * Calculate remaining credits for a team invite
 * Credits are tracked per person, so we get the person's balance
 */
export async function getTeamInviteRemainingCredits(teamInviteId: string): Promise<number> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: teamInviteId },
    select: {
      personId: true
    }
  })

  if (!invite || !invite.personId) {
    return 0
  }

  // Credits are tracked per person, so use getPersonCreditBalance
  return await getPersonCreditBalance(invite.personId)
}

/**
 * Get total credits allocated to a team invite from CreditTransaction records
 * This is the single source of truth for "photos allocated"
 */
export async function getTeamInviteTotalAllocated(teamInviteId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: {
      teamInviteId,
      type: 'invite_allocated'
    },
    _sum: {
      credits: true
    }
  })

  return result._sum.credits ?? 0
}

/**
 * Refund credits for a failed generation
 * Credits are always refunded to personId (Person is the business entity).
 * For team usage, teamId is also set to track team-level balance.
 */
export async function refundCreditsForFailedGeneration(
  personId: string,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  teamId?: string,
  teamInviteId?: string
) {
  if (!personId) {
    throw new Error('personId is required - credits belong to Person, not User')
  }

  Logger.debug('refundCreditsForFailedGeneration called', {
    personId,
    teamId,
    amount,
    hasTeamId: !!teamId
  })

  // For team members (personId exists), refund to team credits
  if (personId && teamId) {
    Logger.debug('Creating team credit refund transaction', { personId, teamId, amount })
    const transaction = await createCreditTransaction({
      credits: amount,
      type: 'refund',
      description: description || `Refund for failed photo generation`,
      teamId: teamId,
      personId: personId, // Track that this person got refunded
      teamInviteId: teamInviteId
    })
    Logger.info('Team credit refund transaction created', { 
      transactionId: transaction.id, 
      teamId: transaction.teamId, 
      personId: transaction.personId 
    })
    return transaction
  }

  // For individual users, refund to personal credits
  Logger.debug('Creating individual credit refund transaction', { personId, amount })
  const transaction = await createCreditTransaction({
    credits: amount,
    type: 'refund',
    description: description || `Refund for failed photo generation`,
    personId: personId,
    teamInviteId: teamInviteId
  })
  Logger.info('Individual credit refund transaction created', {
    transactionId: transaction.id,
    personId: transaction.personId
  })
  return transaction
}

/**
 * Check if person has sufficient credits for generation
 * For team members, checks team balance. For individuals, checks person balance.
 */
export async function hasSufficientCredits(
  personId: string,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  teamId?: string
): Promise<boolean> {
  if (!personId) {
    return false
  }

  let balance: number

  if (teamId) {
    // Use team balance
    balance = await getTeamCreditBalance(teamId)
    Logger.debug('hasSufficientCredits team', { teamId, personId, balance, required: amount })
  } else {
    // Use person balance
    balance = await getPersonCreditBalance(personId)
    Logger.debug('hasSufficientCredits person', { personId, balance, required: amount })
  }

  return balance >= amount
}

/**
 * Calculate credits per dollar from transaction data
 */
export function calculateCreditsPerDollar(credits: number, amount: number): number {
  if (amount === 0) return 0
  return credits / amount
}

/**
 * Get transaction analytics for a user
 */
export async function getTransactionAnalytics(userId: string) {
  const transactions = await prisma.creditTransaction.findMany({
    where: {
      userId,
      type: 'purchase',
      amount: { not: null }
    },
    select: {
      credits: true,
      amount: true,
      planTier: true,
      planPeriod: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  return transactions.map((tx: { credits: number; amount: number | null; planTier: string | null; planPeriod: string | null; createdAt: Date }) => ({
    ...tx,
    creditsPerDollar: calculateCreditsPerDollar(tx.credits, tx.amount || 0)
  }))
}


