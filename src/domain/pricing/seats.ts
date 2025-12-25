import { prisma } from '@/lib/prisma'
import { TEAM_DOMAIN } from '@/config/domain'

/**
 * Volume pricing tiers for seats
 * Must match Stripe product configuration
 */
export const VOLUME_TIERS = [
  { min: 25, max: Infinity, pricePerSeat: 15.96 },
  { min: 10, max: 24, pricePerSeat: 19.90 },
  { min: 1, max: 9, pricePerSeat: 29.00 }
] as const

/**
 * Credits allocated per seat (10 photos per seat)
 */
export const CREDITS_PER_SEAT = 100

/**
 * Get the price per seat based on volume tier
 * Uses volume pricing (tier applies to ALL units, not graduated)
 */
export function getVolumePrice(seatCount: number): number {
  if (seatCount < 1) return 0

  for (const tier of VOLUME_TIERS) {
    if (seatCount >= tier.min && seatCount <= tier.max) {
      return tier.pricePerSeat
    }
  }

  // Fallback to highest tier (25+)
  return VOLUME_TIERS[0].pricePerSeat
}

/**
 * Calculate total price for given number of seats
 */
export function calculateTotal(seats: number): number {
  if (seats < 1) return 0
  const pricePerSeat = getVolumePrice(seats)
  return seats * pricePerSeat
}

/**
 * Calculate savings compared to base tier (1-9 seats)
 */
export function getSavings(seats: number): number {
  if (seats < 1) return 0
  const baseTierPrice = VOLUME_TIERS[2].pricePerSeat
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

  if (seats >= 25) {
    return {
      tier: 'large',
      pricePerSeat,
      nextTierAt: null,
      nextTierPrice: null
    }
  }

  if (seats >= 10) {
    return {
      tier: 'medium',
      pricePerSeat,
      nextTierAt: 25,
      nextTierPrice: VOLUME_TIERS[0].pricePerSeat
    }
  }

  return {
    tier: 'base',
    pricePerSeat,
    nextTierAt: 10,
    nextTierPrice: VOLUME_TIERS[1].pricePerSeat
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
