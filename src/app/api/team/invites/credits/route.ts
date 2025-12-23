import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { getTeamInviteRemainingCredits, getTeamInviteTotalAllocated } from '@/domain/credits/credits'
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

    // Calculate remaining and allocated credits for each invite
    // Uses CreditTransaction records as single source of truth for accepted invites
    type TeamInvite = typeof user.person.team.teamInvites[number];
    const invitesWithCredits = await Promise.all(
      user.person.team.teamInvites.map(async (invite: TeamInvite) => {
        const [remainingCredits, totalAllocated] = await Promise.all([
          getTeamInviteRemainingCredits(invite.id),
          getTeamInviteTotalAllocated(invite.id)
        ])
        // For pending invites (no transactions), fall back to creditsAllocated field
        const creditsAllocated = totalAllocated > 0 ? totalAllocated : (invite.creditsAllocated ?? 0)
        return {
          ...invite,
          remainingCredits,
          creditsAllocated
        }
      })
    )

    type InviteWithCredits = typeof invitesWithCredits[number];
    const totalRemainingCredits = invitesWithCredits.reduce(
      (sum: number, invite: InviteWithCredits) => sum + invite.remainingCredits,
      0
    )

    // Calculate total allocated credits from CreditTransaction (single source of truth)
    const totalAllocatedCredits = invitesWithCredits.reduce(
      (sum: number, invite: InviteWithCredits) => sum + invite.creditsAllocated,
      0
    )

    return NextResponse.json({
      totalAllocatedCredits,
      totalRemainingCredits,
      invites: invitesWithCredits
    })

  } catch (error) {
    Logger.error('Error fetching team invite credits', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
