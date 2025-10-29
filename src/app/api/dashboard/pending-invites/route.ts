import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserWithRoles, getUserEffectiveRoles } from '@/domain/access/roles'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserWithRoles(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const roles = getUserEffectiveRoles(user)
    const companyId = user.person?.companyId

    // Only company admins can see pending invites
    if (!roles.isCompanyAdmin || !companyId) {
      return NextResponse.json({
        success: true,
        pendingInvites: []
      })
    }

    // Get pending team invites
    const pendingInvites = await prisma.teamInvite.findMany({
      where: {
        companyId: companyId,
        usedAt: null, // Only pending invites
        expiresAt: {
          gt: new Date() // Not expired
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedInvites = pendingInvites.map(invite => ({
      id: invite.id,
      email: invite.email,
      name: invite.email.split('@')[0], // Use email prefix as name
      sent: formatTimeAgo(invite.createdAt),
      status: 'pending',
      expiresAt: invite.expiresAt
    }))

    return NextResponse.json({
      success: true,
      pendingInvites: formattedInvites
    })

  } catch (error) {
    Logger.error('Error fetching pending invites', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}
