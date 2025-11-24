import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { getTeamInviteRemainingCredits } from '@/domain/credits/credits'
import { Logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check permission to view team invites
    const permissionCheck = await withTeamPermission(
      request,
      'team.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    // Get user's team invites
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                teamInvites: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      // User is not part of a team yet, return empty response
      return NextResponse.json({
        totalAllocatedCredits: 0,
        totalRemainingCredits: 0,
        invites: []
      })
    }

    // Calculate remaining credits for each invite
    const invitesWithRemainingCredits = await Promise.all(
      user.person.team.teamInvites.map(async (invite) => {
        const remainingCredits = await getTeamInviteRemainingCredits(invite.id)
        return {
          ...invite,
          remainingCredits
        }
      })
    )

    const totalRemainingCredits = invitesWithRemainingCredits.reduce(
      (sum, invite) => sum + invite.remainingCredits,
      0
    )

    // Calculate total allocated credits (credits assigned to invites)
    const totalAllocatedCredits = user.person.team.teamInvites.reduce(
      (sum, invite) => sum + (invite.creditsAllocated ?? 0),
      0
    )

    return NextResponse.json({
      totalAllocatedCredits,
      totalRemainingCredits,
      invites: invitesWithRemainingCredits
    })

  } catch (error) {
    Logger.error('Error fetching team invite credits', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
