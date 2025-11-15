import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'
import { UserService } from '@/domain/services/UserService'
import { Logger } from '@/lib/logger'
import { fetchPendingInvites } from '@/domain/dashboard/activities'
import { formatTimeAgo } from '@/lib/format-time'

export const runtime = 'nodejs'
export async function GET() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // OPTIMIZATION: Use UserService.getUserContext to get all user data in one call
    const userContext = await UserService.getUserContext(userId)
    const teamId = userContext.teamId

    // Only team admins can see pending invites (pro users are team admins by definition)
    if (!userContext.roles.isTeamAdmin || !teamId) {
      return NextResponse.json({
        success: true,
        pendingInvites: []
      })
    }

    // Use shared function to fetch pending invites
    const pendingInvites = await fetchPendingInvites(teamId)

    const formattedInvites = pendingInvites.map(invite => ({
      id: invite.id,
      email: invite.email,
      name: invite.name,
      sent: formatTimeAgo(invite.createdAt, userContext.onboarding.language), // Format using shared utility with locale
      status: invite.status,
      expiresAt: invite.expiresAt
    }))

    return NextResponse.json({
      success: true,
      pendingInvites: formattedInvites
    })

  } catch (error) {
    Logger.error('Error fetching pending invites', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to fetch pending invites')
  }
}
