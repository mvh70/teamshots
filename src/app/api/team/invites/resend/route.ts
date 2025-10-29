import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { withCompanyPermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team invites
    const permissionCheck = await withCompanyPermission(
      request,
      'company.invite_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    // Get user's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: true
          }
        }
      }
    })

    if (!user?.person?.company) {
      return NextResponse.json({ error: 'User is not part of a company' }, { status: 400 })
    }

    // Find the invite
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id,
        companyId: user.person.company.id,
        usedAt: null // Only resend unused invites
      },
      include: {
        company: true
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
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/invite/${invite.token}`
    
    const emailResult = await sendTeamInviteEmail({
      email: invite.email,
      companyName: invite.company.name,
      inviteLink,
      creditsAllocated: invite.creditsAllocated,
      locale: user.locale as 'en' | 'es' || 'en'
    })

    if (!emailResult.success) {
      console.error('Failed to resend team invite email:', emailResult.error)
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
    console.error('Error resending team invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
