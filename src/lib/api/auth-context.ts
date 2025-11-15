import { getUserWithRoles, getUserEffectiveRoles, type UserWithRoles } from '@/domain/access/roles'
import { getUserSubscription, type SubscriptionInfo } from '@/domain/subscription/subscription'

/**
 * Auth context containing user, subscription, and roles data
 * Useful for routes that need all three pieces of information
 */
export interface AuthContext {
  user: UserWithRoles
  subscription: SubscriptionInfo | null
  roles: {
    platformRole: 'user' | 'team_admin' | 'team_member'
    teamRole: 'team_admin' | 'team_member' | null
    isTeamAdmin: boolean
    isTeamMember: boolean
    isPlatformAdmin: boolean
    isRegularUser: boolean
  }
}

/**
 * Get complete auth context (user + subscription + roles) in a single optimized call
 * OPTIMIZATION: Fetches user and subscription in parallel, then computes roles
 * 
 * @param userId - The user ID to fetch context for
 * @returns Auth context with user, subscription, and roles
 * @throws Error if user is not found
 */
export async function getUserAuthContext(userId: string): Promise<AuthContext> {
  // OPTIMIZATION: Fetch user and subscription in parallel
  const [user, subscription] = await Promise.all([
    getUserWithRoles(userId),
    getUserSubscription(userId)
  ])

  if (!user) {
    throw new Error('User not found')
  }

  // Compute effective roles (passes subscription to avoid duplicate query)
  const roles = await getUserEffectiveRoles(user, subscription)

  return {
    user,
    subscription,
    roles
  }
}

