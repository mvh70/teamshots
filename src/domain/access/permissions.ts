import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createPermissionContext, requirePermission, Permission, getUserWithRoles } from '@/domain/access/roles'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'

export async function withPermission(
  request: NextRequest,
  permission: Permission,
  resource?: unknown,
  teamId?: string,
  personId?: string
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await createPermissionContext(session, teamId, personId)
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await requirePermission(context, permission, resource)
    return { context, session }
  } catch {
    await SecurityLogger.logPermissionDenied(
      session.user.id,
      permission,
      JSON.stringify(resource)
    )
    return NextResponse.json(
      { error: 'Permission denied' }, 
      { status: 403 }
    )
  }
}

export async function withTeamPermission(
  request: NextRequest,
  permission: Permission,
  resource?: unknown
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let teamId = session.user.person?.teamId
  let userWithRoles = null
  
  // OPTIMIZATION: Fetch user with full roles data once if needed
  // This avoids duplicate queries in createPermissionContext
  if (!teamId) {
    // Fetch user with full roles data (we'll need it for createPermissionContext anyway)
    userWithRoles = await getUserWithRoles(session.user.id)
    teamId = userWithRoles?.person?.teamId || null
  }

  if (!teamId) {
    return NextResponse.json(
      { error: 'Not part of a team' }, 
      { status: 403 }
    )
  }

  // Pass userWithRoles to avoid re-fetching in createPermissionContext
  // If userWithRoles is null, createPermissionContext will fetch it (backward compatible)
  const context = await createPermissionContext(
    session, 
    teamId,
    undefined,
    userWithRoles ?? undefined
  )
  if (!context) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await requirePermission(context, permission, resource)
    return { context, session, teamId }
  } catch {
    await SecurityLogger.logPermissionDenied(
      session.user.id,
      permission,
      JSON.stringify(resource)
    )
    return NextResponse.json(
      { error: 'Permission denied' }, 
      { status: 403 }
    )
  }
}

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
    if (request) {
      await SecurityLogger.logPermissionDenied(
        session.user.id,
        'platform.admin',
        'admin_access'
      )
    }
    return NextResponse.json(
      { error: 'Admin permission required' }, 
      { status: 403 }
    )
  }
}

export async function checkPermission(
  session: { user?: { id?: string } } | null,
  permission: Permission,
  resource?: unknown,
  teamId?: string,
  personId?: string
): Promise<boolean> {
  if (!session?.user?.id) return false

  const context = await createPermissionContext(session, teamId, personId)
  if (!context) return false

  try {
    await requirePermission(context, permission, resource)
    return true
  } catch {
    return false
  }
}

export async function getUserRoles(session: { user?: { id?: string } } | null) {
  if (!session?.user?.id) return null

  const context = await createPermissionContext(session)
  if (!context) return null

  // Use getUserEffectiveRoles to check pro subscription (pro users are team admins)
  // OPTIMIZATION: Fetch subscription in parallel with user to avoid duplicate queries
  const { getUserWithRoles, getUserEffectiveRoles } = await import('@/domain/access/roles')
  const { getUserSubscription } = await import('@/domain/subscription/subscription')
  const [user, subscription] = await Promise.all([
    getUserWithRoles(session.user.id),
    getUserSubscription(session.user.id)
  ])
  if (!user) return null
  
  // Pass subscription to avoid duplicate query
  const effective = await getUserEffectiveRoles(user, subscription)

  return {
    platformRole: effective.platformRole,
    teamRole: effective.teamRole,
    isTeamAdmin: effective.isTeamAdmin,
    isTeamMember: effective.isTeamMember,
    isPlatformAdmin: effective.isPlatformAdmin,
    isRegularUser: effective.isRegularUser
  }
}


