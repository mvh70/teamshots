import { prisma } from '@/lib/prisma'
import { TEAM_DOMAIN } from '@/config/domain'
import { PRICING_CONFIG } from '@/config/pricing'

/**
 * Graduated pricing tiers for seats
 * Each tier is charged separately and summed (more intuitive than volume pricing)
 * Imported from PRICING_CONFIG to maintain single source of truth
 */
export const GRADUATED_TIERS = PRICING_CONFIG.seats.graduatedTiers

/**
 * Credits allocated per seat (10 photos per seat)
 */
export const CREDITS_PER_SEAT = PRICING_CONFIG.seats.creditsPerSeat

/**
 * Get the price per seat for a specific tier
 * Note: With graduated pricing, different seats can have different prices
 * This returns the tier price for the given seat count range
 */
export function getTierPrice(seatCount: number): number {
  if (seatCount < PRICING_CONFIG.seats.minSeats) return 0

  const tier = GRADUATED_TIERS.find(
    t => seatCount >= t.min && seatCount <= t.max
  )

  // Fallback to most expensive tier (smallest tier: 2-4 seats)
  return tier?.pricePerSeat ?? GRADUATED_TIERS[GRADUATED_TIERS.length - 1].pricePerSeat
}

/**
 * Calculate total price for given number of seats
 */
export function calculateTotal(seats: number): number {
  return PRICING_CONFIG.seats.calculateTotal(seats)
}

/**
 * Calculate savings compared to base tier (smallest tier: 2-4 seats)
 * With graduated pricing, savings come from having seats in lower-priced tiers
 */
export function getSavings(seats: number): number {
  if (seats < PRICING_CONFIG.seats.minSeats) return 0
  // Base tier price is the most expensive (smallest tier: 2-4 seats)
  const baseTierPrice = GRADUATED_TIERS[GRADUATED_TIERS.length - 1].pricePerSeat
  const actualTotal = calculateTotal(seats)
  const baseTotal = seats * baseTierPrice
  return baseTotal - actualTotal
}

/**
 * Get pricing tier information for display
 * Returns the tier that the last seat falls into
 */
export function getPricingTier(seats: number): {
  tier: 'base' | 'medium' | 'large'
  pricePerSeat: number
  nextTierAt: number | null
  nextTierPrice: number | null
} {
  const pricePerSeat = getTierPrice(seats)

  // Find current tier index
  const currentTierIndex = GRADUATED_TIERS.findIndex(
    t => seats >= t.min && seats <= t.max
  )

  // Determine tier category based on position
  const tierCategory: 'base' | 'medium' | 'large' =
    currentTierIndex === -1 ? 'base' :
    currentTierIndex >= GRADUATED_TIERS.length - 2 ? 'base' : // Last 2 tiers = base (2-4, 5-24)
    currentTierIndex <= 1 ? 'large' : // First 2 tiers = large (500-999, 1000+)
    'medium'

  // Find next better tier (lower index = better discount)
  const nextTierIndex = currentTierIndex > 0 ? currentTierIndex - 1 : -1
  const nextTier = nextTierIndex >= 0 ? GRADUATED_TIERS[nextTierIndex] : null

  return {
    tier: tierCategory,
    pricePerSeat,
    nextTierAt: nextTier?.min ?? null,
    nextTierPrice: nextTier?.pricePerSeat ?? null
  }
}

/**
 * Get graduated pricing breakdown showing cost per tier
 * Useful for displaying transparent pricing to customers
 *
 * @param seats - Total number of seats to calculate breakdown for
 * @returns Array of tier breakdowns with seat count and costs per tier
 *
 * @example
 * ```typescript
 * const breakdown = getGraduatedBreakdown(12)
 * // Returns:
 * // [
 * //   { tierRange: "2-4", seatsInTier: 3, pricePerSeat: 29.99, subtotal: 89.97 },
 * //   { tierRange: "5-24", seatsInTier: 9, pricePerSeat: 23.99, subtotal: 215.91 }
 * // ]
 * ```
 */
export function getGraduatedBreakdown(seats: number): Array<{
  tierRange: string
  seatsInTier: number
  pricePerSeat: number
  subtotal: number
}> {
  if (seats < PRICING_CONFIG.seats.minSeats) return []

  const breakdown: Array<{
    tierRange: string
    seatsInTier: number
    pricePerSeat: number
    subtotal: number
  }> = []

  let remaining = seats

  // Process tiers from smallest to largest (reverse config order)
  const tiersAscending = [...GRADUATED_TIERS].reverse()

  for (const tier of tiersAscending) {
    if (remaining <= 0) break

    // Calculate tier capacity
    const tierCapacity = tier.max === Infinity
      ? Infinity
      : tier.max - tier.min + 1

    // Determine how many seats fall in this tier
    const seatsInTier = Math.min(remaining, tierCapacity)

    if (seatsInTier > 0) {
      breakdown.push({
        tierRange: tier.max === Infinity
          ? `${tier.min}+`
          : `${tier.min}-${tier.max}`,
        seatsInTier,
        pricePerSeat: tier.pricePerSeat,
        subtotal: seatsInTier * tier.pricePerSeat
      })
      remaining -= seatsInTier
    }
  }

  return breakdown
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
      totalSeats: true,
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

  // Free plans (totalSeats = 0) use credit-based model
  if (team.totalSeats === 0) {
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
  // Free plans (totalSeats = 0) and legacy teams use credit-based model
  const isSeatsModel = !team.isLegacyCredits && team.admin.signupDomain === TEAM_DOMAIN && team.totalSeats > 0

  // Credit-based teams (legacy or free plans) have no seat limits
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

  // Free plans (totalSeats = 0) use credit-based model, not seats-based
  const isSeatsModel = !team.isLegacyCredits && team.admin.signupDomain === TEAM_DOMAIN && team.totalSeats > 0

  return {
    totalSeats: team.totalSeats,
    activeSeats: team.activeSeats,
    availableSeats: Math.max(0, team.totalSeats - team.activeSeats),
    creditsPerSeat: team.creditsPerSeat,
    isSeatsModel
  }
}
