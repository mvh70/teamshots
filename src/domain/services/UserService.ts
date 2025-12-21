import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { UserWithRoles, UserRole, PermissionContext } from '@/domain/access/roles'
import type { SubscriptionInfo } from '@/domain/subscription/subscription'
import { prisma } from '@/lib/prisma'

/**
 * Consolidated user management service
 * Centralizes all user permission and role logic
 */
export class UserService {
  /**
   * Get complete user context with roles, permissions, subscription, and onboarding data
   * OPTIMIZATION: Single call to get all user-related data instead of multiple separate queries
   */
  static async getUserContext(userId: string): Promise<{
    user: UserWithRoles
    subscription: SubscriptionInfo | null
    roles: {
      platformRole: UserRole
      teamRole: UserRole | null
      isTeamAdmin: boolean
      isTeamMember: boolean
      isPlatformAdmin: boolean
      isRegularUser: boolean
    }
    onboarding: {
      hasUploadedSelfie: boolean
      hasGeneratedPhotos: boolean
      accountMode: 'individual' | 'pro' | 'team_member'
      language: 'en' | 'es'
    }
    teamId: string | null
    person: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string | null
      teamId: string | null
      onboardingState: string | null
      team: {
        id: string
        name: string | null
      } | null
    } | null
  }> {
    // OPTIMIZATION: Fetch all data in parallel to minimize queries
    const [user, subscription, personWithCounts] = await Promise.all([
      getUserWithRoles(userId),
      getUserSubscription(userId),
      // Get person with selfie and generation counts, plus additional fields needed by initial-data route
      prisma.person.findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
          onboardingState: true,
          selfies: { select: { id: true }, take: 1 },
          generations: { select: { id: true }, take: 1 },
          team: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              selfies: true,
              generations: true
            }
          }
        }
      })
    ])

    if (!user) {
      throw new Error('User not found')
    }

    const roles = await getUserEffectiveRoles(user, subscription)

    // Determine account mode
    let accountMode: 'individual' | 'pro' | 'team_member' = 'individual'
    if (subscription?.tier === 'pro') {
      accountMode = 'pro'
    } else if (roles.isTeamMember && !roles.isTeamAdmin) {
      accountMode = 'team_member'
    }

    // Determine language from user record (fallback to 'en')
    const language = (user as { locale?: string })?.locale === 'es' ? 'es' : 'en'

    return {
      user,
      subscription,
      roles,
      onboarding: {
        hasUploadedSelfie: (personWithCounts?._count.selfies ?? 0) > 0,
        hasGeneratedPhotos: (personWithCounts?._count.generations ?? 0) > 0,
        accountMode,
        language: language as 'en' | 'es'
      },
      teamId: personWithCounts?.teamId || null,
      person: personWithCounts ? {
        id: personWithCounts.id,
        firstName: personWithCounts.firstName,
        lastName: personWithCounts.lastName,
        email: personWithCounts.email,
        teamId: personWithCounts.teamId,
        onboardingState: personWithCounts.onboardingState,
        team: personWithCounts.team
      } : null
    }
  }

  /**
   * Create permission context for authorization checks
   * OPTIMIZATION: Reuses user context data to avoid duplicate queries
   */
  static createPermissionContext(
    userContext: Awaited<ReturnType<typeof UserService.getUserContext>>,
    teamId?: string,
    personId?: string
  ): PermissionContext {
    return {
      user: userContext.user,
      teamId: teamId || userContext.teamId || undefined,
      personId,
      subscription: userContext.subscription
    }
  }

  /**
   * Get user roles without full subscription data (lighter weight)
   * OPTIMIZATION: For cases where subscription data isn't needed
   */
  static async getUserRoles(userId: string): Promise<{
    user: UserWithRoles
    roles: {
      platformRole: UserRole
      teamRole: UserRole | null
      isTeamAdmin: boolean
      isTeamMember: boolean
      isPlatformAdmin: boolean
      isRegularUser: boolean
    }
  }> {
    const user = await getUserWithRoles(userId)
    if (!user) {
      throw new Error('User not found')
    }

    const roles = await getUserEffectiveRoles(user)

    return { user, roles }
  }

  /**
   * Check if user is first-time visitor (account created within last 2 hours)
   */
  static isFirstTimeVisitor(user: UserWithRoles): boolean {
    if (!user.createdAt) return false
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    return user.createdAt > twoHoursAgo
  }
}
