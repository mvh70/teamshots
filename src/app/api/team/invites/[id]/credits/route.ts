import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { getEffectiveTeamCreditBalance, transferCreditsFromTeamToPerson } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission to manage team invites
    const permissionCheck = await withTeamPermission(
      request,
      'team.invite_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }
    
    const { session } = permissionCheck
    const { id: inviteId } = await params
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { photosToAdd } = body

    if (!photosToAdd || typeof photosToAdd !== 'number' || photosToAdd < 1) {
      return NextResponse.json({ 
        error: getTranslation('api.errors.teamInvites.invalidPhotosToAdd', locale) || 'Please specify a valid number of photos to add (minimum 1)',
        errorCode: 'INVALID_PHOTOS_TO_ADD'
      }, { status: 400 })
    }

    const creditsToAdd = photosToAdd * PRICING_CONFIG.credits.perGeneration

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
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.userNotInTeam', locale) }, { status: 400 })
    }

    const team = user.person.team

    // Find the invite and verify it belongs to this team
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id: inviteId,
        teamId: team.id
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Check if invite is revoked (expiresAt before createdAt)
    const isRevoked = invite.expiresAt < invite.createdAt
    if (isRevoked) {
      return NextResponse.json({ 
        error: 'Cannot add credits to a revoked invite',
        errorCode: 'INVITE_REVOKED'
      }, { status: 400 })
    }

    // Check if team has sufficient credits
    const teamCredits = await getEffectiveTeamCreditBalance(user.id, team.id)
    
    if (teamCredits < creditsToAdd) {
      return NextResponse.json({ 
        error: getTranslation('api.errors.teamInvites.insufficientTeamCredits', locale, { 
          available: (teamCredits / PRICING_CONFIG.credits.perGeneration).toString(), 
          required: photosToAdd.toString() 
        }),
        errorCode: 'INSUFFICIENT_TEAM_CREDITS',
        availablePhotos: Math.floor(teamCredits / PRICING_CONFIG.credits.perGeneration),
        requiredPhotos: photosToAdd
      }, { status: 400 })
    }

    // Different handling based on whether invite has been accepted
    if (invite.personId) {
      // Accepted invite: Transfer credits from team pool to person (atomic)
      await transferCreditsFromTeamToPerson(
        team.id,
        invite.personId,
        creditsToAdd,
        inviteId,
        `Additional ${photosToAdd} photos added by team admin`
      )

      Logger.info('Transferred credits to accepted invite member', {
        inviteId,
        personId: invite.personId,
        photosAdded: photosToAdd,
        creditsAdded: creditsToAdd,
        addedBy: session.user.id,
        teamId: team.id
      })

      return NextResponse.json({
        success: true,
        invite: {
          id: invite.id,
          email: invite.email,
          firstName: invite.firstName,
          creditsAdded: creditsToAdd,
          photosAdded: photosToAdd
        }
      })
    } else {
      // Pending invite: Update creditsAllocated (no person exists yet)
      const updatedInvite = await prisma.teamInvite.update({
        where: { id: inviteId },
        data: {
          creditsAllocated: invite.creditsAllocated + creditsToAdd
        }
      })

      Logger.info('Added credits to pending invite', {
        inviteId,
        photosAdded: photosToAdd,
        creditsAdded: creditsToAdd,
        newTotal: updatedInvite.creditsAllocated,
        addedBy: session.user.id,
        teamId: team.id
      })

      return NextResponse.json({
        success: true,
        invite: {
          id: updatedInvite.id,
          email: updatedInvite.email,
          firstName: updatedInvite.firstName,
          creditsAllocated: updatedInvite.creditsAllocated,
          photosAllocated: updatedInvite.creditsAllocated / PRICING_CONFIG.credits.perGeneration,
          creditsAdded: creditsToAdd,
          photosAdded: photosToAdd
        }
      })
    }

  } catch (error) {
    Logger.error('Error adding credits to team invite', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: getTranslation('api.errors.internalServerError', 'en')
    }, { status: 500 })
  }
}
