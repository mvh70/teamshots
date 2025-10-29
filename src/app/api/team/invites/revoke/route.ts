import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCompanyPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

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
        companyId: user.person.company.id
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Check if invite is already used
    if (invite.usedAt) {
      return NextResponse.json({ error: 'Cannot revoke used invite' }, { status: 400 })
    }

    // Soft delete the invite by setting expiresAt to past date
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: {
        expiresAt: new Date(Date.now() - 1000) // Set to 1 second ago
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Invite revoked successfully'
    })

  } catch (error) {
    Logger.error('Error revoking team invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
