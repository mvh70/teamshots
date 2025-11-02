import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { Env } from '@/lib/env'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

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

    // Find the invite
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id,
        teamId: user.person.team.id,
        usedAt: null // Only resend unused invites
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        token: true,
        expiresAt: true,
        creditsAllocated: true,
        team: {
          select: {
            name: true
          }
        }
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }

    // Check if invite is expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Cannot resend expired invite' }, { status: 400 })
    }

    // Send email with invite link
    const baseUrl = Env.string('NEXTAUTH_URL', 'http://localhost:3000')
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
