import { prisma } from '@/lib/prisma'
import { TEAM_DOMAIN } from '@/config/domain'
import { PRICING_CONFIG } from '@/config/pricing'

/**
 * Volume pricing tiers for seats
 * Imported from PRICING_CONFIG to maintain single source of truth
 */
export const VOLUME_TIERS = PRICING_CONFIG.seats.volumeTiers

/**
 * Credits allocated per seat (10 photos per seat)
 */
export const CREDITS_PER_SEAT = PRICING_CONFIG.seats.creditsPerSeat

/**
 * Get the price per seat based on volume tier
 * Uses volume pricing (tier applies to ALL units, not graduated)
 */
export function getVolumePrice(seatCount: number): number {
  if (seatCount < PRICING_CONFIG.seats.minSeats) return 0

  const tier = VOLUME_TIERS.find(
    t => seatCount >= t.min && seatCount <= t.max
  )

  // Fallback to most expensive tier (smallest volume)
  return tier?.pricePerSeat ?? VOLUME_TIERS[VOLUME_TIERS.length - 1].pricePerSeat
}

/**
 * Calculate total price for given number of seats
 */
export function calculateTotal(seats: number): number {
  return PRICING_CONFIG.seats.calculateTotal(seats)
}

/**
 * Calculate savings compared to base tier (smallest volume tier)
 */
export function getSavings(seats: number): number {
  if (seats < PRICING_CONFIG.seats.minSeats) return 0
  // Base tier price is the most expensive (smallest volume tier)
  const baseTierPrice = VOLUME_TIERS[VOLUME_TIERS.length - 1].pricePerSeat
  const actualTotal = calculateTotal(seats)
  const baseTotal = seats * baseTierPrice
  return baseTotal - actualTotal
}

/**
 * Get volume tier information for display
 */
export function getVolumeTier(seats: number): {
  tier: 'base' | 'medium' | 'large'
  pricePerSeat: number
  nextTierAt: number | null
  nextTierPrice: number | null
} {
  const pricePerSeat = getVolumePrice(seats)
  
  // Find current tier index
  const currentTierIndex = VOLUME_TIERS.findIndex(
    t => seats >= t.min && seats <= t.max
  )
  
  // Determine tier category based on position
  const tierCategory: 'base' | 'medium' | 'large' = 
    currentTierIndex === -1 ? 'base' :
    currentTierIndex >= VOLUME_TIERS.length - 2 ? 'base' : // Last 2 tiers = base
    currentTierIndex <= 1 ? 'large' : // First 2 tiers = large (best discount)
    'medium'
  
  // Find next better tier (lower index = better discount)
  const nextTierIndex = currentTierIndex > 0 ? currentTierIndex - 1 : -1
  const nextTier = nextTierIndex >= 0 ? VOLUME_TIERS[nextTierIndex] : null

  return {
    tier: tierCategory,
    pricePerSeat,
    nextTierAt: nextTier?.min ?? null,
    nextTierPrice: nextTier?.pricePerSeat ?? null
  }
}

/**
 * Check if a team uses the seats-based pricing model
 *
 * A team uses seats model if:
 * 1. Team admin signed up on teamshotspro.com domain, AND
 * 2. Team has NOT been marked as legacy credits-only
 *
 * @param teamId - The team ID to check
 * @returns true if team uses seats-based pricing
 */
export async function isSeatsBasedTeam(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      isLegacyCredits: true,
      admin: {
        select: { signupDomain: true }
      }
    }
  })

  if (!team) {
    return false
  }

  // Legacy teams stay on credits model
  if (team.isLegacyCredits) {
    return false
  }

  // Check if admin signed up on team domain
  return team.admin.signupDomain === TEAM_DOMAIN
}

/**
 * Check if a team can add a new member
 *
 * For seats-based teams: checks if activeSeats < totalSeats
 * For legacy teams: always returns true (no seat limits)
 *
 * @param teamId - The team ID to check
 * @returns Object with canAdd boolean and optional reason
 */
export async function canAddTeamMember(
  teamId: string
): Promise<{
  canAdd: boolean
  reason?: string
  currentSeats?: number
  totalSeats?: number
}> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      totalSeats: true,
      activeSeats: true,
      isLegacyCredits: true,
      admin: {
        select: { signupDomain: true }
      }
    }
  })

  if (!team) {
    return {
      canAdd: false,
      reason: 'Team not found'
    }
  }

  // Check if this is a seats-based team
  const isSeatsModel = !team.isLegacyCredits && team.admin.signupDomain === TEAM_DOMAIN

  // Legacy teams have no seat limits
  if (!isSeatsModel) {
    return { canAdd: true }
  }

  // Seats-based teams: check seat availability
  if (team.activeSeats >= team.totalSeats) {
    return {
      canAdd: false,
      reason: 'No available seats. Please purchase more seats.',
      currentSeats: team.activeSeats,
      totalSeats: team.totalSeats
    }
  }

  return {
    canAdd: true,
    currentSeats: team.activeSeats,
    totalSeats: team.totalSeats
  }
}

/**
 * Get team seat information for display
 *
 * @param teamId - The team ID
 * @returns Seat information or null if not seats-based
 */
export async function getTeamSeatInfo(teamId: string): Promise<{
  totalSeats: number
  activeSeats: number
  availableSeats: number
  creditsPerSeat: number
  isSeatsModel: boolean
} | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      totalSeats: true,
      activeSeats: true,
      creditsPerSeat: true,
      isLegacyCredits: true,
      admin: {
        select: { signupDomain: true }
      }
    }
  })

  if (!team) {
    return null
  }

  const isSeatsModel = !team.isLegacyCredits && team.admin.signupDomain === TEAM_DOMAIN

  return {
    totalSeats: team.totalSeats,
    activeSeats: team.activeSeats,
    availableSeats: Math.max(0, team.totalSeats - team.activeSeats),
    creditsPerSeat: team.creditsPerSeat,
    isSeatsModel
  }
}
