import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/url'

export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team invites
    const permissionCheck = await withTeamPermission(
      request,
      'team.invite_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
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

    // Find the invite (allow both unused and used invites to be resent)
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id,
        teamId: user.person.team.id
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        creditsAllocated: true,
        personId: true,
        person: {
          select: {
            id: true,
            teamId: true
          }
        },
        team: {
          select: {
            name: true
          }
        }
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const now = new Date()
    let expiresAt = invite.expiresAt
    
    // Check if invite was revoked (expiresAt before createdAt) or expired
    const isRevoked = invite.expiresAt < invite.createdAt
    const isExpired = invite.expiresAt < now
    
    if (isRevoked || isExpired) {
      // Extend expiration date by 24 hours
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
      
      // Update the invite expiration date
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { expiresAt }
      })
    }
    
    // If the invite has a linked person who was revoked (removed from team),
    // re-add them to the team when resending
    if (invite.personId && invite.person && invite.person.teamId !== user.person.team.id) {
      await prisma.person.update({
        where: { id: invite.personId },
        data: { teamId: user.person.team.id }
      })
      
      // Also set usedAt since the person is now active in the team
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() }
      })
      
      Logger.info('Re-added revoked person to team via invite resend', {
        personId: invite.personId,
        teamId: user.person.team.id,
        inviteId: invite.id
      })
    }

    // Send email with invite link (detect domain from request)
    const baseUrl = getBaseUrl(request.headers)
    const inviteLink = `${baseUrl}/invite/${invite.token}`
    
    const emailResult = await sendTeamInviteEmail({
      email: invite.email,
      teamName: invite.team.name,
      inviteLink,
      creditsAllocated: invite.creditsAllocated,
      firstName: invite.firstName,
      locale: user.locale as 'en' | 'es' || 'en'
    })

    if (!emailResult.success) {
      Logger.error('Failed to resend team invite email', { error: emailResult.error })
      return NextResponse.json({ 
        error: 'Failed to send email',
        details: emailResult.error 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invite resent successfully',
      emailSent: true
    })

  } catch (error) {
    Logger.error('Error resending team invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
