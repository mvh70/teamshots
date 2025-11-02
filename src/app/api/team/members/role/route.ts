import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is platform admin
    if (!session.user.isAdmin) {
      await SecurityLogger.logPermissionDenied(
        session.user.id,
        'platform.admin',
        'Team role change attempt by non-platform-admin'
      )
      return NextResponse.json({ 
        error: 'Permission denied. Only platform administrators can change team roles.' 
      }, { status: 403 })
    }

    const { personId, userId, role } = await request.json()

    if (!role || (!personId && !userId)) {
      return NextResponse.json({ 
        error: 'Person ID or User ID and role are required' 
      }, { status: 400 })
    }

    if (!['team_member', 'team_admin'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be team_member or team_admin' 
      }, { status: 400 })
    }

    // Find the target person/user to get their team
    let targetPerson = null
    if (personId) {
      targetPerson = await prisma.person.findFirst({
        where: { id: personId },
        include: {
          user: true,
          team: true
        }
      })
    } else if (userId) {
      targetPerson = await prisma.person.findFirst({
        where: { userId: userId },
        include: {
          user: true,
          team: true
        }
      })
    }

    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    if (!targetPerson.team) {
      return NextResponse.json({ error: 'Target user is not part of a team' }, { status: 400 })
    }

    const teamId = targetPerson.team.id

    // Security check: Prevent demoting the only admin in a team
    if (targetPerson.userId === session.user.id && role === 'team_member') {
      // Check if this is the only admin trying to demote themselves
      const adminCount = await prisma.person.count({
        where: {
          teamId: teamId,
          userId: { not: null },
          user: {
            role: 'team_admin'
          }
        }
      })

      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot demote yourself as the only admin. Promote another member first.' 
        }, { status: 400 })
      }
    }

    // If promoting to admin, update the team's adminId
    if (role === 'team_admin') {
      if (!targetPerson.userId) {
        return NextResponse.json({ 
          error: 'Cannot promote guest user to admin. User must have an account.' 
        }, { status: 400 })
      }

      // Update team admin
      await prisma.team.update({
        where: { id: teamId },
        data: { adminId: targetPerson.userId }
      })

      // Update user role
      await prisma.user.update({
        where: { id: targetPerson.userId },
        data: { role: 'team_admin' }
      })
    } else {
      // Demoting to member
      if (targetPerson.userId) {
        await prisma.user.update({
          where: { id: targetPerson.userId },
          data: { role: 'team_member' }
        })
      }

      // If this was the admin, we need to assign a new admin
      if (targetPerson.team.adminId === targetPerson.userId) {
        // Find another team member to promote to admin
        const otherMember = await prisma.person.findFirst({
          where: {
            teamId: teamId,
            userId: { not: null },
            id: { not: targetPerson.id }
          },
          include: {
            user: true
          }
        })

        if (otherMember?.userId) {
          await prisma.team.update({
            where: { id: teamId },
            data: { adminId: otherMember.userId }
          })

          await prisma.user.update({
            where: { id: otherMember.userId },
            data: { role: 'team_admin' }
          })
        } else {
          return NextResponse.json({ 
            error: 'Cannot demote the only admin. Promote another member first.' 
          }, { status: 400 })
        }
      }
    }

    // Log the successful role change for security auditing
    await SecurityLogger.logSuspiciousActivity(
      session.user.id,
      'team_role_change',
      {
        targetUserId: targetPerson.userId,
        targetPersonId: targetPerson.id,
        newRole: role,
        teamId: teamId,
        isSelfChange: targetPerson.userId === session.user.id
      }
    )

    return NextResponse.json({
      success: true,
      message: `Role updated to ${role} successfully`
    })

  } catch (error) {
    Logger.error('Error updating member role', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
