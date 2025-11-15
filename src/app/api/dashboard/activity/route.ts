import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'
import { UserService } from '@/domain/services/UserService'
import { Logger } from '@/lib/logger'
import { fetchUserActivities } from '@/domain/dashboard/activities'

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
    
    // Only show activity for team admins
    if (!userContext.roles.isTeamAdmin) {
      return NextResponse.json({
        success: true,
        activities: []
      })
    }
    
    const teamId = userContext.teamId

    // Use shared activity fetching logic
    const activities = await fetchUserActivities(userId, teamId, 10, true)

    return NextResponse.json({
      success: true,
      activities
    })

  } catch (error) {
    Logger.error('Error fetching dashboard activity', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to fetch dashboard activity')
  }
}
