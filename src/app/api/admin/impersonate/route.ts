import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'


export const runtime = 'nodejs'
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

    // Set the impersonation cookie
    const cookieStore = await cookies()
    cookieStore.set('impersonate_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/'
    })

    // Return the impersonation data
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
 * DELETE /api/admin/impersonate
 * Stop impersonating and return to admin account
 */
export async function DELETE() {
  try {
    const session = await auth()
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the original admin user ID from session
    const originalUserId = session.user.originalUserId || session.user.id

    // Log the impersonation stop
    await SecurityLogger.logSuspiciousActivity(
      originalUserId,
      'impersonation_stop',
      { 
        impersonatedUserId: session.user.id
      }
    )

    // Clear the impersonation cookie
    const cookieStore = await cookies()
    cookieStore.delete('impersonate_user_id')

    return NextResponse.json({ 
      success: true,
      message: 'Impersonation stopped'
    })
  } catch (error) {
    console.error('Error stopping impersonation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

