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
    const companyName = user.person?.company?.name || null

    // Base stats for all users
    const stats: {
      photosGenerated: number
      activeTemplates: number
      creditsUsed: number
      teamMembers?: number
      pendingInvites?: number
    } = {
      photosGenerated: 0,
      activeTemplates: 0,
      creditsUsed: 0,
      teamMembers: 0, // Only relevant for company admins
    }

    // Get user's generations count
    const generationsCount = await prisma.generation.count({
      where: {
        OR: [
          // Personal generations
          { 
            person: { 
              userId: session.user.id 
            } 
          },
          // Company generations (if user is part of a company)
          ...(companyId ? [{
            person: {
              companyId: companyId
            }
          }] : [])
        ]
      }
    })

    stats.photosGenerated = generationsCount

    // Get active templates (contexts) count
    const contextsCount = await prisma.context.count({
      where: {
        OR: [
          // Personal contexts
          { userId: session.user.id },
          // Company contexts (if user is part of a company)
          ...(companyId ? [{ companyId }] : [])
        ]
      }
    })

    stats.activeTemplates = contextsCount

    // Get credits used from generations
    const creditsUsedResult = await prisma.generation.aggregate({
      where: {
        OR: [
          // Personal generations
          { 
            person: { 
              userId: session.user.id 
            } 
          },
          // Company generations (if user is part of a company)
          ...(companyId ? [{
            person: {
              companyId: companyId
            }
          }] : [])
        ]
      },
      _sum: {
        creditsUsed: true
      }
    })

    stats.creditsUsed = creditsUsedResult._sum.creditsUsed || 0

    // Get team members count (only for company admins)
    if (roles.isCompanyAdmin && companyId) {
      const teamMembersCount = await prisma.person.count({
        where: {
          companyId: companyId
        }
      })
      stats.teamMembers = teamMembersCount
    }

    return NextResponse.json({
      success: true,
      stats,
      userRole: {
        isCompanyAdmin: roles.isCompanyAdmin,
        isCompanyMember: roles.isCompanyMember,
        isRegularUser: roles.isRegularUser,
        companyId: companyId,
        companyName: companyName,
        needsCompanySetup: roles.isCompanyAdmin && !companyId
      }
    })

  } catch (error) {
    Logger.error('Error fetching dashboard stats', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
