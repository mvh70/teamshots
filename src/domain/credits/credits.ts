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
  | 'invite_allocated'
  | 'invite_revoked'

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
 */
export async function getTeamCreditBalance(teamId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { teamId },
    _sum: { credits: true }
  })
  const balance = result._sum.credits || 0
  Logger.debug('getTeamCreditBalance', { teamId, balance })
  return balance
}

/**
 * Get effective team credit balance for a user
 * This includes:
 * - Team credits (if teamId is provided)
 * - Unmigrated pro credits on userId (if user has pro tier)
 * 
 * This is the centralized function that should be used everywhere
 * to get the "total available team credits" for a user.
 */
export async function getEffectiveTeamCreditBalance(userId: string, teamId?: string | null): Promise<number> {
  // OPTIMIZATION: Run independent queries in parallel
  // Team balance and subscription are independent, so fetch them simultaneously
  const [teamBalance, subscription] = await Promise.all([
    teamId ? getTeamCreditBalance(teamId) : Promise.resolve(0),
    getUserSubscription(userId)
  ])
  
  const hasProTier = subscription?.tier === 'pro'
  
  // If user has pro tier, also check for unmigrated pro credits on userId
  // This handles the case where credits were assigned before team was created
  if (hasProTier) {
    const userProBalance = await prisma.creditTransaction.aggregate({
      where: {
        userId: userId,
        planTier: 'pro',
        teamId: null, // Only count credits not yet migrated
        credits: { gt: 0 }
      },
      _sum: { credits: true }
    })
    
    const unmigratedCredits = userProBalance._sum.credits || 0
    const totalBalance = teamBalance + unmigratedCredits
    
    Logger.debug('getEffectiveTeamCreditBalance', { 
      userId, 
      teamId, 
      teamBalance, 
      unmigratedCredits, 
      totalBalance,
      hasProTier 
    })
    
    return totalBalance
  }
  
  // If no pro tier but has team, return team balance
  if (teamId) {
    return teamBalance
  }
  
  // No team and no pro tier
  return 0
}

/**
 * Get current credit balance for a person
 * For team members, this returns the remaining allocated credits (allocation - usage)
 * Credits are tracked per person, not per invite
 * For individual users, this returns their personal credit balance
 */
export async function getPersonCreditBalance(personId: string): Promise<number> {
  // First, check if this person has a team invite with allocation
  const invite = await prisma.teamInvite.findFirst({
    where: { personId }
  })

  // If person has a team invite, calculate remaining allocation
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
    
    // Return remaining: allocation from transactions - net usage
    const remaining = Math.max(0, totalAllocated - netCreditsUsed)
    return remaining
  }

  // Otherwise, return standard credit balance (sum of all person transactions)
  const result = await prisma.creditTransaction.aggregate({
    where: { personId },
    _sum: { credits: true }
  })
  
  let balance = result._sum.credits || 0

  // Check for unmigrated Pro credits on the linked user
  // This is for Pro users who haven't created a team yet (deferred setup)
  // We only do this if they are NOT in a team (otherwise they'd use team credits)
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { userId: true, teamId: true }
  })

  if (person?.userId && !person.teamId) {
    const userProBalance = await prisma.creditTransaction.aggregate({
      where: {
        userId: person.userId,
        planTier: 'pro',
        teamId: null,
        credits: { gt: 0 }
      },
      _sum: { credits: true }
    })
    
    balance += (userProBalance._sum.credits || 0)
  }

  return balance
}

/**
 * Get current credit balance for a user
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { userId },
    _sum: { credits: true }
  })
  return result._sum.credits || 0
}

/**
 * Transfer credits from team to person
 */
export async function transferCreditsFromTeamToPerson(
  teamId: string,
  personId: string,
  amount: number,
  description?: string
) {
  // Check team has enough credits
  const teamBalance = await getTeamCreditBalance(teamId)
  if (teamBalance < amount) {
    throw new Error(`Insufficient credits. Team has ${teamBalance}, trying to transfer ${amount}`)
  }

  // Create debit transaction for team
  const debitTransaction = await createCreditTransaction({
    credits: -amount,
    type: 'transfer_out',
    description: description || `Transfer to team member`,
    teamId
  })

  // Create credit transaction for person
  const creditTransaction = await createCreditTransaction({
    credits: amount,
    type: 'transfer_in',
    description: description || `Transfer from team`,
    personId,
    relatedTransactionId: debitTransaction.id
  })

  return {
    debitTransaction,
    creditTransaction
  }
}

/**
 * Allocate credits to a person from an invite
 * This creates a record of allocation WITHOUT transferring credits from team
 * Credits remain with the team until they are actually used for generation
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
  const totalCredits = userProCredits.reduce((sum, tx) => sum + tx.credits, 0)

  // Migrate each transaction by updating teamId
  // We keep the userId for audit trail, but add teamId
  await prisma.$transaction(
    userProCredits.map(tx =>
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
 */
export async function useCreditsForGeneration(
  personId: string | null,
  userId: string | null,
  amount: number,
  description?: string
) {
  if (!personId && !userId) {
    throw new Error('Either personId or userId must be provided')
  }

  return await createCreditTransaction({
    credits: -amount,
    type: 'generation',
    description: description || `Used for photo generation`,
    personId: personId || undefined,
    userId: userId || undefined
  })
}

/**
 * Reserve credits for a generation (deduct immediately)
 * SECURITY: Wraps balance check and credit deduction in atomic transaction
 * to prevent race condition where two concurrent requests could both check
 * sufficient balance and both deduct, causing overdraft
 */
export async function reserveCreditsForGeneration(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  teamId?: string,
  teamInviteId?: string
) {
  if (!personId && !userId) {
    throw new Error('Either personId or userId must be provided')
  }

  // SECURITY: Use transaction with Serializable isolation to prevent race conditions
  // This ensures balance check + deduction happens atomically
  return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // For team members (personId exists), deduct from team AND track person usage
    if (personId && teamId) {
      // Fetch user ID for balance check if not provided
      let userIdForBalance: string | null = userId

      if (!userIdForBalance) {
        const personResult = await tx.person.findUnique({
          where: { id: personId },
          select: {
            userId: true,
            team: {
              select: {
                adminId: true
              }
            }
          }
        })

        userIdForBalance = personResult?.userId || personResult?.team?.adminId || null
      }

      // Calculate team balance within transaction (use aggregate for atomic read)
      const teamBalanceResult = await tx.creditTransaction.aggregate({
        where: { teamId },
        _sum: { credits: true }
      })
      let totalBalance = teamBalanceResult._sum.credits || 0

      // Add unmigrated pro credits if applicable
      if (userIdForBalance) {
        const subscription = await getUserSubscription(userIdForBalance)
        const hasProTier = subscription?.tier === 'pro'

        if (hasProTier) {
          const userProBalance = await tx.creditTransaction.aggregate({
            where: {
              userId: userIdForBalance,
              planTier: 'pro',
              teamId: null,
              credits: { gt: 0 }
            },
            _sum: { credits: true }
          })
          const unmigratedCredits = userProBalance._sum.credits || 0
          totalBalance += unmigratedCredits
        }
      }

      Logger.debug('Credit validation (in transaction)', { teamId, userId: userIdForBalance, balance: totalBalance, required: amount })

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
    if (personId) {
      // Person balance calculation
      const invite = await tx.teamInvite.findFirst({
        where: { personId }
      })

      if (invite) {
        // Calculate allocated credits
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
        const netCreditsUsed = usageTransactions.reduce((sum, t) => sum - t.credits, 0)

        balance = Math.max(0, totalAllocated - netCreditsUsed)
      } else {
        // Standard balance
        const balanceResult = await tx.creditTransaction.aggregate({
          where: { personId },
          _sum: { credits: true }
        })
        balance = balanceResult._sum.credits || 0

        // Check for unmigrated Pro credits
        const person = await tx.person.findUnique({
          where: { id: personId },
          select: { userId: true, teamId: true }
        })

        if (person?.userId && !person.teamId) {
          const userProBalance = await tx.creditTransaction.aggregate({
            where: {
              userId: person.userId,
              planTier: 'pro',
              teamId: null,
              credits: { gt: 0 }
            },
            _sum: { credits: true }
          })
          balance += (userProBalance._sum.credits || 0)
        }
      }
    } else {
      // User balance
      const balanceResult = await tx.creditTransaction.aggregate({
        where: { userId: userId! },
        _sum: { credits: true }
      })
      balance = balanceResult._sum.credits || 0
    }

    Logger.debug('Credit validation (in transaction)', { personId, userId, balance, required: amount })

    if (balance < amount) {
      throw new Error(`Insufficient credits. Available: ${balance}, Required: ${amount}`)
    }

    return await tx.creditTransaction.create({
      data: {
        credits: -amount,
        type: 'generation',
        description: description || `Reserved for photo generation`,
        personId: personId || undefined,
        userId: userId || undefined,
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
 */
export async function refundCreditsForFailedGeneration(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  teamId?: string,
  teamInviteId?: string
) {
  if (!personId && !userId) {
    throw new Error('Either personId or userId must be provided')
  }

  Logger.debug('refundCreditsForFailedGeneration called', {
    personId,
    userId,
    teamId,
    amount,
    hasTeamId: !!teamId,
    hasPersonId: !!personId
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
  Logger.debug('Creating individual credit refund transaction', { personId, userId, amount })
  const transaction = await createCreditTransaction({
    credits: amount,
    type: 'refund',
    description: description || `Refund for failed photo generation`,
    personId: personId || undefined,
    userId: userId || undefined,
    teamInviteId: teamInviteId
  })
  Logger.info('Individual credit refund transaction created', { 
    transactionId: transaction.id, 
    personId: transaction.personId, 
    userId: transaction.userId,
    teamId: transaction.teamId
  })
  return transaction
}

/**
 * Check if user has sufficient credits for generation
 */
export async function hasSufficientCredits(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  teamId?: string
): Promise<boolean> {
  if (!personId && !userId && !teamId) {
    return false
  }

  let balance: number

  if (teamId && userId) {
    // Use effective team balance (includes unmigrated pro credits)
    balance = await getEffectiveTeamCreditBalance(userId, teamId)
    Logger.debug('hasSufficientCredits team', { teamId, userId, balance, required: amount })
  } else if (teamId) {
    // Fallback to basic team balance if no userId provided
    balance = await getTeamCreditBalance(teamId)
    Logger.debug('hasSufficientCredits team (no userId)', { teamId, balance, required: amount })
  } else if (personId) {
    balance = await getPersonCreditBalance(personId)
    Logger.debug('hasSufficientCredits person', { personId, balance, required: amount })
  } else {
    balance = await getUserCreditBalance(userId!)
    Logger.debug('hasSufficientCredits user', { userId, balance, required: amount })
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


