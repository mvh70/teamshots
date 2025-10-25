import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'
import { auth } from '@/auth'

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
        'Team role change attempt by non-platform-admin',
        request
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

    if (!['company_member', 'company_admin'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be company_member or company_admin' 
      }, { status: 400 })
    }

    // Find the target person/user to get their company
    let targetPerson = null
    if (personId) {
      targetPerson = await prisma.person.findFirst({
        where: { id: personId },
        include: {
          user: true,
          company: true
        }
      })
    } else if (userId) {
      targetPerson = await prisma.person.findFirst({
        where: { userId: userId },
        include: {
          user: true,
          company: true
        }
      })
    }

    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    if (!targetPerson.company) {
      return NextResponse.json({ error: 'Target user is not part of a company' }, { status: 400 })
    }

    const companyId = targetPerson.company.id

    // Security check: Prevent demoting the only admin in a company
    if (targetPerson.userId === session.user.id && role === 'company_member') {
      // Check if this is the only admin trying to demote themselves
      const adminCount = await prisma.person.count({
        where: {
          companyId: companyId,
          userId: { not: null },
          user: {
            role: 'company_admin'
          }
        }
      })

      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot demote yourself as the only admin. Promote another member first.' 
        }, { status: 400 })
      }
    }

    // If promoting to admin, update the company's adminId
    if (role === 'company_admin') {
      if (!targetPerson.userId) {
        return NextResponse.json({ 
          error: 'Cannot promote guest user to admin. User must have an account.' 
        }, { status: 400 })
      }

      // Update company admin
      await prisma.company.update({
        where: { id: companyId },
        data: { adminId: targetPerson.userId }
      })

      // Update user role
      await prisma.user.update({
        where: { id: targetPerson.userId },
        data: { role: 'company_admin' }
      })
    } else {
      // Demoting to member
      if (targetPerson.userId) {
        await prisma.user.update({
          where: { id: targetPerson.userId },
          data: { role: 'company_member' }
        })
      }

      // If this was the admin, we need to assign a new admin
      if (targetPerson.company.adminId === targetPerson.userId) {
        // Find another company member to promote to admin
        const otherMember = await prisma.person.findFirst({
          where: {
            companyId: companyId,
            userId: { not: null },
            id: { not: targetPerson.id }
          },
          include: {
            user: true
          }
        })

        if (otherMember?.userId) {
          await prisma.company.update({
            where: { id: companyId },
            data: { adminId: otherMember.userId }
          })

          await prisma.user.update({
            where: { id: otherMember.userId },
            data: { role: 'company_admin' }
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
        companyId: companyId,
        isSelfChange: targetPerson.userId === session.user.id
      },
      request
    )

    return NextResponse.json({
      success: true,
      message: `Role updated to ${role} successfully`
    })

  } catch (error) {
    console.error('Error updating member role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
