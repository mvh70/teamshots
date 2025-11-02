import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'

/**
 * GET /api/admin/impersonate?userId=xxx
 * Start impersonating a user
 */
export async function GET(request: NextRequest) {
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
        'admin.impersonate',
        'Impersonation attempt by non-admin'
      )
      return NextResponse.json({ error: 'Permission denied. Only platform administrators can impersonate users.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // Fetch the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isAdmin: true,
        locale: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent impersonating other admins for security
    if (targetUser.isAdmin) {
      return NextResponse.json({ error: 'Cannot impersonate other platform administrators' }, { status: 403 })
    }

    // Log the impersonation start
    await SecurityLogger.logSuspiciousActivity(
      session.user.id,
      'impersonation_start',
      { 
        targetUserId: userId,
        targetEmail: targetUser.email,
        adminId: session.user.id,
        adminEmail: session.user.email
      }
    )

    // Return the impersonation token that can be used in session
    return NextResponse.json({ 
      success: true,
      impersonationData: {
        originalUserId: session.user.id,
        impersonatedUserId: targetUser.id,
        impersonatedUser: targetUser
      }
    })
  } catch (error) {
    console.error('Error starting impersonation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/impersonate/stop
 * Stop impersonating and return to admin account
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the impersonation data from request body
    const body = await request.json()
    const { impersonatedUserId } = body

    if (!impersonatedUserId) {
      return NextResponse.json({ error: 'Missing impersonatedUserId' }, { status: 400 })
    }

    // Log the impersonation stop
    await SecurityLogger.logSuspiciousActivity(
      session.user.id,
      'impersonation_stop',
      { 
        impersonatedUserId,
        adminId: session.user.id
      }
    )

    return NextResponse.json({ 
      success: true,
      message: 'Impersonation stopped'
    })
  } catch (error) {
    console.error('Error stopping impersonation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

