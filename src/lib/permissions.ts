import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createPermissionContext, requirePermission, Permission } from '@/lib/roles'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'

/**
 * Middleware helper to check permissions in API routes
 */
export async function withPermission(
  request: NextRequest,
  permission: Permission,
  resource?: unknown,
  companyId?: string,
  personId?: string
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await createPermissionContext(session, companyId, personId)
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await requirePermission(context, permission, resource)
    return { context, session }
  } catch {
    // Add security logging
    await SecurityLogger.logPermissionDenied(
      session.user.id,
      permission,
      JSON.stringify(resource),
      request
    )
    return NextResponse.json(
      { error: 'Permission denied' }, 
      { status: 403 }
    )
  }
}

/**
 * Middleware helper for company-specific operations
 */
export async function withCompanyPermission(
  request: NextRequest,
  permission: Permission,
  resource?: unknown
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has companyId in session, if not, check database
  let companyId = session.user.person?.companyId
  
  if (!companyId) {
    // Try to get companyId from database if not in session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          select: { companyId: true }
        }
      }
    })
    
    companyId = user?.person?.companyId || null
  }

  if (!companyId) {
    return NextResponse.json(
      { error: 'Not part of a company' }, 
      { status: 403 }
    )
  }

  const context = await createPermissionContext(
    session, 
    companyId
  )
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await requirePermission(context, permission, resource)
    return { context, session, companyId }
  } catch {
    // Add security logging
    await SecurityLogger.logPermissionDenied(
      session.user.id,
      permission,
      JSON.stringify(resource),
      request
    )
    return NextResponse.json(
      { error: 'Permission denied' }, 
      { status: 403 }
    )
  }
}

/**
 * Middleware helper for admin operations
 */
export async function withAdminPermission(request?: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await createPermissionContext(session)
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await requirePermission(context, 'platform.admin')
    return { context, session }
  } catch {
    // Add security logging if request is provided
    if (request) {
      await SecurityLogger.logPermissionDenied(
        session.user.id,
        'platform.admin',
        'admin_access',
        request
      )
    }
    return NextResponse.json(
      { error: 'Admin permission required' }, 
      { status: 403 }
    )
  }
}

/**
 * Utility to check if user has permission without throwing
 */
export async function checkPermission(
  session: { user?: { id?: string } } | null,
  permission: Permission,
  resource?: unknown,
  companyId?: string,
  personId?: string
): Promise<boolean> {
  if (!session?.user?.id) return false

  const context = await createPermissionContext(session, companyId, personId)
  if (!context) return false

  try {
    await requirePermission(context, permission, resource)
    return true
  } catch {
    return false
  }
}

/**
 * Get user's effective roles for UI display
 */
export async function getUserRoles(session: { user?: { id?: string } } | null) {
  if (!session?.user?.id) return null

  const context = await createPermissionContext(session)
  if (!context) return null

  return {
    platformRole: context.user.role,
    companyRole: context.user.person?.companyId ? 
      (context.user.person.company?.adminId === context.user.id ? 'company_admin' : 'company_member') : 
      null,
    isCompanyAdmin: context.user.person?.company?.adminId === context.user.id,
    isCompanyMember: !!context.user.person?.companyId,
    isPlatformAdmin: context.user.isAdmin,
    isRegularUser: context.user.role === 'user' && !context.user.person?.companyId
  }
}
