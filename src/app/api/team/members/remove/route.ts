import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { Logger } from '@/lib/logger'
import { getPersonCreditBalance, createCreditTransaction } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'

export async function POST(request: NextRequest) {
  try {
    // Check permission to manage team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage_members'
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

    const teamId = user.person.team.id

    // Find the target person/user
    let targetPerson = null
    if (personId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          id: personId,
          teamId: teamId
        },
        include: {
          user: true
        }
      })
    } else if (userId) {
      targetPerson = await prisma.person.findFirst({
        where: {
          userId: userId,
          teamId: teamId
        },
        include: {
          user: true
        }
      })
    }

    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found in your team' }, { status: 404 })
    }

    // Prevent revoking yourself
    if (targetPerson.userId === session.user.id) {
      return NextResponse.json({ 
        error: 'Cannot revoke your own access to the team' 
      }, { status: 400 })
    }

    // Check if this is the only admin
    if (user.person.team.adminId === targetPerson.userId) {
      const adminCount = await prisma.person.count({
        where: {
          teamId: teamId,
          userId: { not: null }
        }
      })

      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot revoke the only admin. Promote another member first.' 
        }, { status: 400 })
      }
    }

    // Reclaim unused credits before revoking access
    let creditsReclaimed = 0
    try {
      // Get the member's remaining credit balance
      const remainingCredits = await getPersonCreditBalance(targetPerson.id)
      
      if (remainingCredits > 0) {
        // Find the invite associated with this person to link the transaction
        const invite = await prisma.teamInvite.findFirst({
          where: { personId: targetPerson.id }
        })

        // Create a negative transaction to deduct remaining credits from the member
        await createCreditTransaction({
          credits: -remainingCredits, // Negative to deduct
          type: 'invite_revoked',
          description: `Credits reclaimed when member access was revoked`,
          personId: targetPerson.id,
          teamId: teamId,
          teamInviteId: invite?.id,
          userId: session.user.id // Track who revoked
        })

        creditsReclaimed = remainingCredits
        
        Logger.info('Reclaimed credits from revoked member', {
          personId: targetPerson.id,
          creditsReclaimed,
          photosReclaimed: creditsReclaimed / PRICING_CONFIG.credits.perGeneration,
          teamId,
          revokedBy: session.user.id
        })
      }
    } catch (creditError) {
      // Log but don't fail the revoke operation
      Logger.error('Failed to reclaim credits during member revoke', {
        personId: targetPerson.id,
        error: creditError instanceof Error ? creditError.message : String(creditError)
      })
    }

    // Revoke the person's access to the team
    await prisma.person.update({
      where: { id: targetPerson.id },
      data: { 
        teamId: null,
        // Keep the person record but unlink from team
      }
    })

    // If this was an admin, promote another member
    if (user.person.team.adminId === targetPerson.userId) {
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
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Member access revoked successfully',
      creditsReclaimed,
      photosReclaimed: creditsReclaimed / PRICING_CONFIG.credits.perGeneration
    })

  } catch (error) {
    Logger.error('Error revoking team member access', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
