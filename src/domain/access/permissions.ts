import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createPermissionContext, requirePermission, Permission } from '@/domain/access/roles'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'

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

export async function withCompanyPermission(
  request: NextRequest,
  permission: Permission,
  resource?: unknown
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let companyId = session.user.person?.companyId
  
  if (!companyId) {
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

export async function getUserRoles(session: { user?: { id?: string } } | null) {
  if (!session?.user?.id) return null

  const context = await createPermissionContext(session)
  if (!context) return null

  return {
    platformRole: context.user.role === 'company_admin' ? 'team_admin' : context.user.role === 'company_member' ? 'team_member' : 'user',
    companyRole: context.user.role === 'company_admin' ? 'team_admin' :
      context.user.role === 'company_member' ? 'team_member' : null,
    isCompanyAdmin: context.user.role === 'company_admin',
    isCompanyMember: context.user.role === 'company_member',
    isPlatformAdmin: context.user.isAdmin,
    isRegularUser: context.user.role === 'user'
  }
}


