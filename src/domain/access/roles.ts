import { prisma } from '@/lib/prisma'
import { getUserSubscription, SubscriptionInfo } from '@/domain/subscription/subscription'

export type UserRole = 'user' | 'team_admin' | 'team_member'

export interface UserWithRoles {
  id: string
  email: string
  role: UserRole
  isAdmin: boolean
  person?: {
    id: string
    teamId?: string | null
    team?: {
      id: string
      name: string
      adminId: string
    } | null
  } | null
}

export interface PermissionContext {
  user: UserWithRoles
  teamId?: string
  personId?: string
}

/**
 * Determine the effective role of a user based on their User role, subscription tier, and team relationships
 * Pro users are by definition team admins
 * 
 * @param user - User with roles information
 * @param subscription - Optional subscription info to avoid duplicate queries. If not provided, will fetch it.
 */
export async function getUserEffectiveRoles(
  user: UserWithRoles,
  subscription?: SubscriptionInfo | null
): Promise<{
  platformRole: 'user' | 'team_admin' | 'team_member'
  teamRole: 'team_admin' | 'team_member' | null
  isTeamAdmin: boolean
  isTeamMember: boolean
  isPlatformAdmin: boolean
  isRegularUser: boolean
}> {
  const isPlatformAdmin = user.isAdmin
  
  // Check if user has pro subscription - pro users are team admins by definition
  // Only fetch subscription if not provided (optimization to avoid duplicate queries)
  const subscriptionData = subscription ?? await getUserSubscription(user.id)
  const hasProTier = subscriptionData?.tier === 'pro'
  
  // User is team admin if:
  // 1. They have the 'team_admin' role in the database, OR
  // 2. They have a pro subscription (pro users are team admins by definition)
  const isTeamAdmin = user.role === 'team_admin' || hasProTier
  
  // Team members are ONLY invited members (cannot be pro users)
  // Pro users are team admins, not team members
  const isTeamMember = user.role === 'team_member' && !hasProTier
  
  return {
    platformRole: isTeamAdmin ? 'team_admin' : isTeamMember ? 'team_member' : 'user',
    teamRole: isTeamAdmin ? 'team_admin' : isTeamMember ? 'team_member' : null,
    isTeamAdmin,
    isTeamMember,
    isPlatformAdmin,
    isRegularUser: user.role === 'user' && !hasProTier
  }
}

/**
 * Check if user has permission to perform an action
 */
export async function hasPermission(
  context: PermissionContext,
  action: Permission,
  resource?: unknown
): Promise<boolean> {
  const roles = await getUserEffectiveRoles(context.user)
  
  switch (action) {
    case 'platform.admin':
      return roles.isPlatformAdmin
    case 'user.manage_own_account':
      return context.user.id === (resource as { userId?: string })?.userId
    case 'team.view':
      return roles.isTeamAdmin || roles.isTeamMember || 
             Boolean(context.teamId && context.user.person?.teamId === context.teamId)
    case 'team.manage':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'team.invite_members':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'team.manage_members':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'team.allocate_credits':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'team.view_analytics':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'generation.create_personal':
      return true
    case 'generation.create_team':
      // Both team admins (pro users) and team members (invited) can create team generations
      return (roles.isTeamAdmin || roles.isTeamMember) && 
             context.teamId === context.user.person?.teamId
    case 'generation.view_own':
      return context.user.id === (resource as { userId?: string })?.userId ||
             context.personId === (resource as { personId?: string })?.personId
    case 'generation.view_team':
      // Only team admins (pro users) can view all team generations
      // Team members can only see their own photos
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId &&
             (resource as { teamId?: string })?.teamId === context.teamId
    case 'generation.approve':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'credits.view_own':
      return true
    case 'credits.view_team':
      // Both team admins (pro users) and team members can view team credits
      return (roles.isTeamAdmin || roles.isTeamMember) && 
             context.teamId === context.user.person?.teamId
    case 'credits.allocate_team':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'files.upload':
      return true
    case 'files.view_own':
      return context.user.id === (resource as { userId?: string })?.userId ||
             context.personId === (resource as { personId?: string })?.personId
    case 'files.view_team':
      // Both team admins (pro users) and team members can view team files
      return (roles.isTeamAdmin || roles.isTeamMember) && 
             context.teamId === context.user.person?.teamId &&
             (resource as { teamId?: string })?.teamId === context.teamId
    case 'context.create_personal':
      return true
    case 'context.create_team':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    case 'context.view_own':
      return context.user.id === (resource as { userId?: string })?.userId
    case 'context.view_team':
      // Both team admins (pro users) and team members can view team contexts
      return (roles.isTeamAdmin || roles.isTeamMember) && 
             context.teamId === context.user.person?.teamId &&
             (resource as { teamId?: string })?.teamId === context.teamId
    case 'context.manage_team':
      return roles.isTeamAdmin && 
             context.teamId === context.user.person?.teamId
    default:
      return false
  }
}

/**
 * Get user with full role context from database
 */
export async function getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      person: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              adminId: true
            }
          }
        }
      }
    }
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
    isAdmin: user.isAdmin,
    person: user.person ? {
      id: user.person.id,
      teamId: user.person.teamId,
      team: user.person.team ? {
        id: user.person.team.id,
        name: user.person.team.name,
        adminId: user.person.team.adminId
      } : null
    } : null
  }
}

/**
 * Require permission or throw error
 */
export async function requirePermission(
  context: PermissionContext,
  action: Permission,
  resource?: unknown
): Promise<void> {
  const hasAccess = await hasPermission(context, action, resource)
  if (!hasAccess) {
    throw new Error(`Permission denied: ${action}`)
  }
}

/**
 * Middleware helper to create permission context from session
 * 
 * @param session - Session object with user info
 * @param teamId - Optional team ID
 * @param personId - Optional person ID
 * @param user - Optional user with roles to avoid duplicate queries. If not provided, will fetch it.
 */
export async function createPermissionContext(
  session: { user?: { id?: string } } | null,
  teamId?: string,
  personId?: string,
  user?: UserWithRoles | null
): Promise<PermissionContext | null> {
  if (!session?.user?.id) return null

  // OPTIMIZATION: Only fetch user if not provided (avoids duplicate queries)
  const userWithRoles = user ?? await getUserWithRoles(session.user.id)
  if (!userWithRoles) return null

  return {
    user: userWithRoles,
    teamId,
    personId
  }
}

export type Permission = 
  | 'platform.admin'
  | 'user.manage_own_account'
  | 'team.view'
  | 'team.manage'
  | 'team.invite_members'
  | 'team.manage_members'
  | 'team.allocate_credits'
  | 'team.view_analytics'
  | 'generation.create_personal'
  | 'generation.create_team'
  | 'generation.view_own'
  | 'generation.view_team'
  | 'generation.approve'
  | 'credits.view_own'
  | 'credits.view_team'
  | 'credits.allocate_team'
  | 'files.upload'
  | 'files.view_own'
  | 'files.view_team'
  | 'context.create_personal'
  | 'context.create_team'
  | 'context.view_own'
  | 'context.view_team'
  | 'context.manage_team'


