import { prisma } from '@/lib/prisma'

export type UserRole = 'user' | 'company_admin' | 'company_member'

export interface UserWithRoles {
  id: string
  email: string
  role: UserRole
  isAdmin: boolean
  person?: {
    id: string
    companyId?: string | null
    company?: {
      id: string
      name: string
      adminId: string
    } | null
  } | null
}

export interface PermissionContext {
  user: UserWithRoles
  companyId?: string
  personId?: string
}

/**
 * Determine the effective role of a user based on their User role and company relationships
 */
export function getUserEffectiveRoles(user: UserWithRoles): {
  platformRole: 'user' | 'team_admin' | 'team_member'
  companyRole: 'team_admin' | 'team_member' | null
  isCompanyAdmin: boolean
  isCompanyMember: boolean
  isPlatformAdmin: boolean
  isRegularUser: boolean
} {
  const isPlatformAdmin = user.isAdmin
  const isCompanyAdmin = user.role === 'company_admin'
  const isCompanyMember = user.role === 'company_member'
  
  return {
    platformRole: user.role === 'company_admin' ? 'team_admin' : user.role === 'company_member' ? 'team_member' : 'user',
    companyRole: isCompanyAdmin ? 'team_admin' : isCompanyMember ? 'team_member' : null,
    isCompanyAdmin,
    isCompanyMember,
    isPlatformAdmin,
    isRegularUser: user.role === 'user'
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
  const roles = getUserEffectiveRoles(context.user)
  
  switch (action) {
    case 'platform.admin':
      return roles.isPlatformAdmin
    case 'user.manage_own_account':
      return context.user.id === (resource as { userId?: string })?.userId
    case 'company.view':
      return roles.isCompanyAdmin || roles.isCompanyMember || 
             Boolean(context.companyId && context.user.person?.companyId === context.companyId)
    case 'company.manage':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'company.invite_members':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'company.manage_members':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'company.allocate_credits':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'company.view_analytics':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'generation.create_personal':
      return true
    case 'generation.create_company':
      return roles.isCompanyMember && 
             context.companyId === context.user.person?.companyId
    case 'generation.view_own':
      return context.user.id === (resource as { userId?: string })?.userId ||
             context.personId === (resource as { personId?: string })?.personId
    case 'generation.view_company':
      return roles.isCompanyMember && 
             context.companyId === context.user.person?.companyId &&
             (resource as { companyId?: string })?.companyId === context.companyId
    case 'generation.approve':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'credits.view_own':
      return true
    case 'credits.view_company':
      return roles.isCompanyMember && 
             context.companyId === context.user.person?.companyId
    case 'credits.allocate_company':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'files.upload':
      return true
    case 'files.view_own':
      return context.user.id === (resource as { userId?: string })?.userId ||
             context.personId === (resource as { personId?: string })?.personId
    case 'files.view_company':
      return roles.isCompanyMember && 
             context.companyId === context.user.person?.companyId &&
             (resource as { companyId?: string })?.companyId === context.companyId
    case 'context.create_personal':
      return true
    case 'context.create_company':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
    case 'context.view_own':
      return context.user.id === (resource as { userId?: string })?.userId
    case 'context.view_company':
      return roles.isCompanyMember && 
             context.companyId === context.user.person?.companyId &&
             (resource as { companyId?: string })?.companyId === context.companyId
    case 'context.manage_company':
      return roles.isCompanyAdmin && 
             context.companyId === context.user.person?.companyId
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
          company: {
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
      companyId: user.person.companyId,
      company: user.person.company ? {
        id: user.person.company.id,
        name: user.person.company.name,
        adminId: user.person.company.adminId
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
 */
export async function createPermissionContext(
  session: { user?: { id?: string } } | null,
  companyId?: string,
  personId?: string
): Promise<PermissionContext | null> {
  if (!session?.user?.id) return null

  const user = await getUserWithRoles(session.user.id)
  if (!user) return null

  return {
    user,
    companyId,
    personId
  }
}

export type Permission = 
  | 'platform.admin'
  | 'user.manage_own_account'
  | 'company.view'
  | 'company.manage'
  | 'company.invite_members'
  | 'company.manage_members'
  | 'company.allocate_credits'
  | 'company.view_analytics'
  | 'generation.create_personal'
  | 'generation.create_company'
  | 'generation.view_own'
  | 'generation.view_company'
  | 'generation.approve'
  | 'credits.view_own'
  | 'credits.view_company'
  | 'credits.allocate_company'
  | 'files.upload'
  | 'files.view_own'
  | 'files.view_company'
  | 'context.create_personal'
  | 'context.create_company'
  | 'context.view_own'
  | 'context.view_company'
  | 'context.manage_company'


