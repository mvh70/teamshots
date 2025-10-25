import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCompanyPermission } from '@/lib/permissions'
import { getTeamInviteRemainingCredits } from '@/lib/credits'

export async function GET(request: NextRequest) {
  try {
    // Check permission to view team invites
    const permissionCheck = await withCompanyPermission(
      request,
      'company.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    // Get user's company invites
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: {
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

    if (!user?.person?.company) {
      // User is not part of a company yet, return empty response
      return NextResponse.json({
        totalRemainingCredits: 0,
        invites: []
      })
    }

    // Calculate remaining credits for each invite
    const invitesWithRemainingCredits = await Promise.all(
      user.person.company.teamInvites.map(async (invite) => {
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

    return NextResponse.json({
      totalRemainingCredits,
      invites: invitesWithRemainingCredits
    })

  } catch (error) {
    console.error('Error fetching team invite credits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
