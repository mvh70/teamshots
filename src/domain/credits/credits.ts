import { prisma } from '@/lib/prisma'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'

export type CreditTransactionType =
  | 'purchase'
  | 'transfer_in'
  | 'transfer_out'
  | 'generation'
  | 'refund'
  | 'invite_allocated'

export interface CreateCreditTransactionParams {
  credits: number
  type: CreditTransactionType
  description?: string
  companyId?: string
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
      companyId: params.companyId,
      personId: params.personId,
      userId: params.userId,
      teamInviteId: params.teamInviteId,
      relatedTransactionId: params.relatedTransactionId
    }
  })
}

/**
 * Get current credit balance for a company
 */
export async function getCompanyCreditBalance(companyId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { companyId },
    _sum: { credits: true }
  })
  const balance = result._sum.credits || 0
  Logger.debug('getCompanyCreditBalance', { companyId, balance })
  return balance
}

/**
 * Get current credit balance for a person
 */
export async function getPersonCreditBalance(personId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { personId },
    _sum: { credits: true }
  })
  return result._sum.credits || 0
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
 * Transfer credits from company to person
 */
export async function transferCreditsFromCompanyToPerson(
  companyId: string,
  personId: string,
  amount: number,
  description?: string
) {
  // Check company has enough credits
  const companyBalance = await getCompanyCreditBalance(companyId)
  if (companyBalance < amount) {
    throw new Error(`Insufficient credits. Company has ${companyBalance}, trying to transfer ${amount}`)
  }

  // Create debit transaction for company
  const debitTransaction = await createCreditTransaction({
    credits: -amount,
    type: 'transfer_out',
    description: description || `Transfer to team member`,
    companyId
  })

  // Create credit transaction for person
  const creditTransaction = await createCreditTransaction({
    credits: amount,
    type: 'transfer_in',
    description: description || `Transfer from company`,
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
 */
export async function reserveCreditsForGeneration(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  companyId?: string,
  teamInviteId?: string
) {
  if (!personId && !userId) {
    throw new Error('Either personId or userId must be provided')
  }

  // For team members (personId exists), use company credits
  if (personId && companyId) {
    const companyBalance = await getCompanyCreditBalance(companyId)
    Logger.debug('Credit validation', { companyId, balance: companyBalance, required: amount })
    if (companyBalance < amount) {
      throw new Error(`Insufficient company credits. Available: ${companyBalance}, Required: ${amount}`)
    }

    return await createCreditTransaction({
      credits: -amount,
      type: 'generation',
      description: description || `Reserved for photo generation`,
      companyId: companyId,
      teamInviteId: teamInviteId
    })
  }

  // For individual users, use personal credits
  const balance = personId
    ? await getPersonCreditBalance(personId)
    : await getUserCreditBalance(userId!)

  if (balance < amount) {
    throw new Error(`Insufficient credits. Available: ${balance}, Required: ${amount}`)
  }

  return await createCreditTransaction({
    credits: -amount,
    type: 'generation',
    description: description || `Reserved for photo generation`,
    personId: personId || undefined,
    userId: userId || undefined,
    teamInviteId: teamInviteId
  })
}

/**
 * Calculate remaining credits for a team invite
 */
export async function getTeamInviteRemainingCredits(teamInviteId: string): Promise<number> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: teamInviteId },
    include: {
      creditTransactions: {
        where: {
          type: 'generation' // Only count generation transactions
        }
      }
    }
  })

  if (!invite) {
    return 0
  }

  const usedCredits = invite.creditTransactions.reduce((sum: number, transaction: { amount: number | null }) => {
    return sum + Math.abs(transaction.amount ?? 0) // Amount is negative, so we need absolute value
  }, 0)

  return Math.max(0, (invite.creditsAllocated ?? 0) - usedCredits)
}

/**
 * Refund credits for a failed generation
 */
export async function refundCreditsForFailedGeneration(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  description?: string,
  companyId?: string,
  teamInviteId?: string
) {
  if (!personId && !userId) {
    throw new Error('Either personId or userId must be provided')
  }

  // For team members (personId exists), refund to company credits
  if (personId && companyId) {
    return await createCreditTransaction({
      credits: amount,
      type: 'refund',
      description: description || `Refund for failed photo generation`,
      companyId: companyId,
      teamInviteId: teamInviteId
    })
  }

  // For individual users, refund to personal credits
  return await createCreditTransaction({
    credits: amount,
    type: 'refund',
    description: description || `Refund for failed photo generation`,
    personId: personId || undefined,
    userId: userId || undefined,
    teamInviteId: teamInviteId
  })
}

/**
 * Check if user has sufficient credits for generation
 */
export async function hasSufficientCredits(
  personId: string | null,
  userId: string | null,
  amount: number = PRICING_CONFIG.credits.perGeneration,
  companyId?: string
): Promise<boolean> {
  if (!personId && !userId && !companyId) {
    return false
  }

  let balance: number

  if (companyId) {
    balance = await getCompanyCreditBalance(companyId)
    Logger.debug('hasSufficientCredits company', { companyId, balance, required: amount })
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


