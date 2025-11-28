import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

/**
 * Check if an email is already part of the team
 * Used for real-time validation in the invite form
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission to view team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Get user's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                teamMembers: {
                  select: {
                    email: true
                  }
                },
                teamInvites: {
                  where: {
                    email: email.toLowerCase(),
                    expiresAt: { gt: new Date() } // Only check non-expired invites
                  },
                  select: {
                    id: true,
                    usedAt: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json({ error: 'User is not part of a team' }, { status: 400 })
    }

    const team = user.person.team
    const emailLower = email.toLowerCase()

    // Check if email is already a team member (active or revoked)
    const isMember = team.teamMembers.some(
      member => member.email?.toLowerCase() === emailLower
    )

    // Check if there's a pending invite for this email (non-expired, not used)
    const hasPendingInvite = team.teamInvites.length > 0 && team.teamInvites.some(
      invite => !invite.usedAt
    )

    // Check if there's a used invite for this email (revoked members)
    const hasUsedInvite = team.teamInvites.length > 0 && team.teamInvites.some(
      invite => invite.usedAt !== null
    )

    return NextResponse.json({
      isMember,
      hasPendingInvite,
      hasUsedInvite,
      canInvite: !isMember && !hasPendingInvite
    })

  } catch (error) {
    Logger.error('Error checking email', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

