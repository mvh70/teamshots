import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { Env } from '@/lib/env'
import { randomBytes } from 'crypto'
import { withTeamPermission } from '@/domain/access/permissions'
import { getEffectiveTeamCreditBalance, getTeamInviteRemainingCredits } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'

export async function POST(request: NextRequest) {
  try {
    // Check permission to invite team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.invite_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { email, firstName, creditsAllocated = PRICING_CONFIG.team.defaultInviteCredits } = await request.json()

    // Get user locale from session for translations
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    if (!email) {
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.emailRequired', locale) }, { status: 400 })
    }

    if (!firstName) {
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.firstNameRequired', locale) }, { status: 400 })
    }

    // Validate credits allocation
    const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration
    if (creditsAllocated % creditsPerGeneration !== 0) {
      const error = getTranslation('api.errors.teamInvites.invalidCreditAllocation', locale, { 
        credits: creditsPerGeneration.toString(),
        credits2: (creditsPerGeneration * 2).toString(),
        credits3: (creditsPerGeneration * 3).toString()
      })
      return NextResponse.json({ 
        error,
        errorCode: 'INVALID_CREDIT_ALLOCATION'
      }, { status: 400 })
    }

    // Get user's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: { activeContext: true, admin: true }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.userNotInTeam', locale) }, { status: 400 })
    }

    const team = user.person.team

    // Check if team admin is on free plan
    const rawAdminPlanPeriod = (team?.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
    // Normalize period: 'month' -> 'monthly', 'year' -> 'annual', otherwise as-is
    const adminPlanPeriod = rawAdminPlanPeriod === 'month' ? 'monthly' : rawAdminPlanPeriod === 'year' ? 'annual' : rawAdminPlanPeriod
    const isAdminOnFreePlan = adminPlanPeriod === 'free' || !adminPlanPeriod

    // If no active context, check if we can use free package context
    let contextToUse = team?.activeContext
    if (!contextToUse && isAdminOnFreePlan) {
      // Get free package context
      const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })
      if (setting?.value) {
        const freePackageContext = await prisma.context.findUnique({ 
          where: { id: setting.value }
        })
        if (freePackageContext) {
          contextToUse = freePackageContext
        }
      }
    }

    if (!contextToUse) {
      return NextResponse.json({ 
        error: getTranslation('api.errors.teamInvites.noActiveContext', locale),
        errorCode: 'NO_ACTIVE_CONTEXT',
        helpUrl: '/app/contexts'
      }, { status: 400 })
    }

    // Check if team has sufficient credits (uses centralized function)
    const teamCredits = await getEffectiveTeamCreditBalance(user.id, team.id)
    
    if (teamCredits < creditsAllocated) {
      return NextResponse.json({ 
        error: getTranslation('api.errors.teamInvites.insufficientTeamCredits', locale, { 
          available: teamCredits.toString(), 
          required: creditsAllocated.toString() 
        }),
        errorCode: 'INSUFFICIENT_TEAM_CREDITS',
        availableCredits: teamCredits,
        requiredCredits: creditsAllocated
      }, { status: 400 })
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create team invite with context reference
    const teamInvite = await prisma.teamInvite.create({
      data: {
        email,
        firstName,
        teamId: user.person.team.id,
        token,
        expiresAt,
        creditsAllocated,
        contextId: contextToUse.id
      }
    })

    // Send email with invite link
    const baseUrl = Env.string('NEXTAUTH_URL', 'http://localhost:3000')
    const inviteLink = `${baseUrl}/invite/${token}`
    
    const emailResult = await sendTeamInviteEmail({
      email: teamInvite.email,
      teamName: team.name,
      inviteLink,
      creditsAllocated: teamInvite.creditsAllocated,
      firstName,
      locale: user.locale as 'en' | 'es' || 'en'
    })

    if (!emailResult.success) {
      Logger.error('Failed to send team invite email', { error: emailResult.error })
      // Still return success for the invite creation, but log the email error
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: teamInvite.id,
        email: teamInvite.email,
        token: teamInvite.token,
        expiresAt: teamInvite.expiresAt,
        creditsAllocated: teamInvite.creditsAllocated,
        inviteLink
      },
      emailSent: emailResult.success
    })

  } catch (error) {
    Logger.error('Error creating team invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: getTranslation('api.errors.internalServerError', 'en') }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check permission to view team invites
    const permissionCheck = await withTeamPermission(
      request,
      'team.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    // Get user's team invites
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: {
                teamInvites: {
                  include: {
                    context: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      // User is not part of a team yet, return empty response
      return NextResponse.json({
        invites: []
      })
    }

    // Calculate credits used for each invite
    const invitesWithCredits = await Promise.all(
      user.person.team.teamInvites.map(async (invite: unknown) => {
        const typedInvite = invite as {
          id: string
          email: string
          firstName: string
          token: string
          expiresAt: Date
          usedAt: Date | null
          creditsAllocated: number
          createdAt: Date
          context: { id: string; name: string } | null
        }
        const remainingCredits = await getTeamInviteRemainingCredits(typedInvite.id)
        const creditsUsed = typedInvite.creditsAllocated - remainingCredits
        return {
          id: typedInvite.id,
          email: typedInvite.email,
          firstName: typedInvite.firstName,
          token: typedInvite.token,
          expiresAt: typedInvite.expiresAt,
          usedAt: typedInvite.usedAt,
          creditsAllocated: typedInvite.creditsAllocated,
          creditsUsed,
          creditsRemaining: remainingCredits,
          createdAt: typedInvite.createdAt,
          contextId: typedInvite.context?.id,
          contextName: typedInvite.context?.name
        }
      })
    )

    return NextResponse.json({
      invites: invitesWithCredits
    })

  } catch (error) {
    Logger.error('Error fetching team invites', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: getTranslation('api.errors.internalServerError', 'en') }, { status: 500 })
  }
}
