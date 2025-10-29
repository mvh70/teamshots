import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'
import { Logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is platform admin
    if (!session.user.isAdmin) {
      await SecurityLogger.logPermissionDenied(
        session.user.id,
        'admin.change_role',
        'Role change attempt by non-admin'
      )
      return NextResponse.json({ error: 'Permission denied. Only platform administrators can change roles.' }, { status: 403 })
    }

    const { userId, newRole } = await request.json()

    // Validate input
    if (!userId || !newRole) {
      return NextResponse.json({ error: 'Missing userId or newRole' }, { status: 400 })
    }

    if (!['user', 'company_admin'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role. Must be "user" or "company_admin"' }, { status: 400 })
    }

    // Prevent changing other users' roles (for now, only allow self-role changes)
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Can only change your own role for testing purposes' }, { status: 400 })
    }

    // Update the user's role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      include: {
        person: {
          include: {
            company: true
          }
        }
      }
    })

    // Log the role change
    await SecurityLogger.logSuspiciousActivity(
      session.user.id,
      'role_change',
      { 
        targetUserId: userId, 
        oldRole: session.user.role || 'user', 
        newRole: newRole 
      }
    )

    return NextResponse.json({ 
      success: true, 
      message: `Role changed to ${newRole}`,
      user: {
        id: updatedUser.id,
        role: updatedUser.role
      }
    })

  } catch (error) {
    Logger.error('Error changing role', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
