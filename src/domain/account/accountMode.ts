/**
 * Centralized account mode determination
 * 
 * Three modes:
 * - 'pro': Signed up users with pro subscription (see team features)
 * - 'individual': Signed up users without pro (see personal features)
 * - 'team_member': Invited members accessing through token (no sidebar)
 */

import { getUserSubscription, SubscriptionInfo } from '@/domain/subscription/subscription'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'

export type AccountMode = 'pro' | 'individual' | 'team_member'

export interface AccountModeResult {
  mode: AccountMode
  isPro: boolean
  isIndividual: boolean
  isTeamMember: boolean
  subscriptionTier: string | null
  hasProTier: boolean
}

/**
 * Determine account mode server-side
 * 
 * @param userId - User ID to get account mode for
 * @param subscription - Optional subscription info to avoid duplicate queries. If not provided, will fetch it.
 */
export async function getAccountMode(
  userId: string | null | undefined,
  subscription?: SubscriptionInfo | null
): Promise<AccountModeResult> {
  // Default to individual if no user
  if (!userId) {
    return {
      mode: 'individual',
      isPro: false,
      isIndividual: true,
      isTeamMember: false,
      subscriptionTier: null,
      hasProTier: false,
    }
  }

  // OPTIMIZATION: Run independent queries in parallel
  // Only fetch subscription if not provided (optimization to avoid duplicate queries)
  const [subscriptionData, user] = await Promise.all([
    subscription ?? getUserSubscription(userId),
    getUserWithRoles(userId)
  ])

  const subscriptionTier = subscriptionData?.tier ?? null
  const hasProTier = subscriptionTier === 'pro'

  // Check user roles (pro users are team admins by definition)
  // This depends on the user result, so it runs after the parallel queries
  // Pass subscription to avoid duplicate query
  const effective = user ? await getUserEffectiveRoles(user, subscriptionData) : null

  // Determine mode:
  // - If user has pro tier, they're in pro mode (and are team admins by definition)
  // - If user is team admin (from role or pro subscription), they're in pro mode
  // - Team members (invited, non-pro) are NOT pro users - they're handled separately via token routes
  // - Otherwise, they're in individual mode
  const isProUser = hasProTier || (effective?.isTeamAdmin ?? false)

  const mode: AccountMode = isProUser ? 'pro' : 'individual'

  return {
    mode,
    isPro: mode === 'pro',
    isIndividual: mode === 'individual',
    isTeamMember: false, // Team members are determined via token, not here
    subscriptionTier,
    hasProTier,
  }
}

/**
 * Client-side hook to determine account mode
 * Should fetch from API endpoint that uses getAccountMode
 */
export async function fetchAccountMode(): Promise<AccountModeResult> {
  const response = await fetch('/api/account/mode')
  if (!response.ok) {
    return {
      mode: 'individual',
      isPro: false,
      isIndividual: true,
      isTeamMember: false,
      subscriptionTier: null,
      hasProTier: false,
    }
  }
  return response.json()
}

