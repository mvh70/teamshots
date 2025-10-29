import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCompanyPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team members
    const permissionCheck = await withCompanyPermission(
      request,
      'company.manage_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { personId, userId } = await request.json()

    if (!personId && !userId) {
      return NextResponse.json({ 
        error: 'Person ID or User ID is required' 
      }, { status: 400 })
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

    const companyId = user.person.company.id

    // Find the target person/user
    let targetPerson = null
    if (personId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          id: personId,
          companyId: companyId
        },
        include: {
          user: true
        }
      })
    } else if (userId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          userId: userId,
          companyId: companyId
        },
        include: {
          user: true
        }
      })
    }

    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found in your company' }, { status: 404 })
    }

    // Prevent removing yourself
    if (targetPerson.userId === session.user.id) {
      return NextResponse.json({ 
        error: 'Cannot remove yourself from the company' 
      }, { status: 400 })
    }

    // Check if this is the only admin
    if (user.person.company.adminId === targetPerson.userId) {
      const adminCount = await prisma.person.count({
        where: {
          companyId: companyId,
          userId: { not: null }
        }
      })

      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot remove the only admin. Promote another member first.' 
        }, { status: 400 })
      }
    }

    // Remove the person from the company
    await prisma.person.update({
      where: { id: targetPerson.id },
      data: { 
        companyId: null,
        // Keep the person record but unlink from company
      }
    })

    // If this was an admin, promote another member
    if (user.person.company.adminId === targetPerson.userId) {
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
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })

  } catch (error) {
    Logger.error('Error removing team member', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
