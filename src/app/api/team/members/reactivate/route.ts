import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

/**
 * Reactivate a revoked team member
 * Restores their teamId so they can access the team again with their invite token
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { personId, userId } = await request.json()

    if (!personId && !userId) {
      return NextResponse.json({ 
        error: 'Person ID or User ID is required' 
      }, { status: 400 })
    }

    // Get user's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json({ error: 'User is not part of a team' }, { status: 400 })
    }

    const teamId = user.person.team.id

    // Find the target person - check both active and revoked members
    // Revoked members have teamId = null but may have an invite for this team
    let targetPerson = null
    if (personId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          id: personId,
          // Include both active members and revoked members (teamId = null)
          OR: [
            { teamId: teamId },
            { teamId: null }
          ]
        },
        include: {
          user: true,
          teamInvite: {
            where: {
              teamId: teamId,
              usedAt: { not: null }
            }
          }
        }
      })
    } else if (userId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          userId: userId,
          OR: [
            { teamId: teamId },
            { teamId: null }
          ]
        },
        include: {
          user: true,
          teamInvite: {
            where: {
              teamId: teamId,
              usedAt: { not: null }
            }
          }
        }
      })
    }

    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Verify they have an invite for this team (security check)
    if (!targetPerson.teamInvite) {
      return NextResponse.json({ 
        error: 'This person does not have an invite for this team' 
      }, { status: 400 })
    }

    // Check if they're already active
    if (targetPerson.teamId === teamId) {
      return NextResponse.json({ 
        error: 'This member is already active in the team' 
      }, { status: 400 })
    }

    // Reactivate by setting teamId back
    await prisma.person.update({
      where: { id: targetPerson.id },
      data: { 
        teamId: teamId
      }
    })

    Logger.info('Team member reactivated', {
      personId: targetPerson.id,
      userId: targetPerson.userId,
      teamId: teamId,
      reactivatedBy: session.user.id
    })

    return NextResponse.json({
      success: true,
      message: 'Member reactivated successfully'
    })

  } catch (error) {
    Logger.error('Error reactivating team member', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

