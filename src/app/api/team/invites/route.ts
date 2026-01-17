import { NextRequest, NextResponse } from 'next/server'
import { prisma, Prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { withTeamPermission } from '@/domain/access/permissions'
import { getEffectiveTeamCreditBalance, getTeamInviteRemainingCredits, getTeamInviteTotalAllocated } from '@/domain/credits/credits'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'
import { getPackageConfig } from '@/domain/style/packages'
import { getBaseUrl } from '@/lib/url'
import { isSeatsBasedTeam, canAddTeamMember } from '@/domain/pricing/seats'

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

    const body = await request.json()
    const { email, firstName, skipEmail = false } = body

    // Get user locale from session for translations
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    if (!email) {
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.emailRequired', locale) }, { status: 400 })
    }

    if (!firstName) {
      return NextResponse.json({ error: getTranslation('api.errors.teamInvites.firstNameRequired', locale) }, { status: 400 })
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

    // Determine pricing model for this team
    const useSeatsModel = await isSeatsBasedTeam(team.id)

    // Determine credits to allocate based on pricing model
    let creditsAllocated: number

    if (useSeatsModel) {
      // Seats model: Auto-assign fixed credits per seat
      creditsAllocated = PRICING_CONFIG.seats.creditsPerSeat

      // Check if team has available seats
      const seatCheck = await canAddTeamMember(team.id)
      if (!seatCheck.canAdd) {
        return NextResponse.json({
          error: getTranslation('api.errors.teamInvites.noAvailableSeats', locale, {
            current: seatCheck.currentSeats?.toString() || '0',
            total: seatCheck.totalSeats?.toString() || '0'
          }),
          errorCode: 'NO_AVAILABLE_SEATS',
          currentSeats: seatCheck.currentSeats,
          totalSeats: seatCheck.totalSeats
        }, { status: 400 })
      }
    } else {
      // Credits model: Use client-provided value with validation
      creditsAllocated = body.creditsAllocated || PRICING_CONFIG.team.defaultInviteCredits

      // Validate credits allocation (credits model only)
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
    }

    // Check if team admin is on free plan
    const rawAdminPlanPeriod = (team?.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
    // Normalize period: 'month' -> 'monthly', 'year' -> 'annual', otherwise as-is
    const adminPlanPeriod = rawAdminPlanPeriod === 'month' ? 'monthly' : rawAdminPlanPeriod === 'year' ? 'annual' : rawAdminPlanPeriod
    const isAdminOnFreePlan = adminPlanPeriod === 'free' || !adminPlanPeriod

    // For free plan admins, always use free package context (create if needed)
    // For paid plan admins, use team's active context
    let contextToUse: typeof team.activeContext = null
    if (isAdminOnFreePlan) {
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
      
      // If free package context doesn't exist, create it automatically
      if (!contextToUse) {
        try {
          const pkg = getPackageConfig('freepackage')
          const defaultSettings = pkg.defaultSettings
          const serializedSettings = pkg.persistenceAdapter.serialize(defaultSettings) as Record<string, unknown>
          // Store stylePreset in settings
          serializedSettings.stylePreset = pkg.defaultPresetId
          
          // Create the free package context with default settings
          const newContext = await prisma.context.create({
            data: {
              name: 'Free Package Style',
              settings: serializedSettings as Prisma.InputJsonValue,
            },
            select: { id: true },
          })
          
          // Save it to appSetting for future use
          await prisma.appSetting.upsert({
            where: { key: 'freePackageStyleId' },
            update: { value: newContext.id },
            create: { key: 'freePackageStyleId', value: newContext.id },
          })
          
          // Use the newly created context
          contextToUse = await prisma.context.findUnique({ 
            where: { id: newContext.id }
          })
          
          Logger.info('Auto-created free package context for team invitation', { 
            contextId: newContext.id, 
            teamId: team.id 
          })
        } catch (error) {
          Logger.error('Failed to auto-create free package context', { 
            error: error instanceof Error ? error.message : String(error),
            teamId: team.id 
          })
          // Fall through to error below
        }
      }
    } else {
      // Paid plan: use team's active context
      contextToUse = team?.activeContext ?? null
    }

    if (!contextToUse) {
      return NextResponse.json({ 
        error: getTranslation('api.errors.teamInvites.noActiveContext', locale),
        errorCode: 'NO_ACTIVE_CONTEXT',
        helpUrl: '/app/contexts'
      }, { status: 400 })
    }

    // Check team size limits based on admin's plan tier
    // Note: With seats-based pricing, team size is limited by available seats
    // Individual tier users don't have team features
    // VIP tier users have unlimited team members

    // Check if team has sufficient credits (skip for seats model)
    if (!useSeatsModel) {
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

    // Build invite link (detect domain from request)
    const baseUrl = getBaseUrl(request.headers)
    const inviteLink = `${baseUrl}/invite/${token}`

    // Send email unless skipEmail is true (for "Create Link" flow)
    let emailSent = false
    if (!skipEmail) {
      // Calculate inviter first name safely
      const inviterName = session.user.name || ''
      const inviterFirstName = inviterName.split(' ')[0] || inviterName || 'Team Admin'

      const emailResult = await sendTeamInviteEmail({
        email: teamInvite.email,
        teamName: team.name || 'Team',
        inviteLink,
        creditsAllocated: teamInvite.creditsAllocated,
        firstName,
        inviterFirstName,
        locale: user.locale as 'en' | 'es' || 'en'
      })

      emailSent = emailResult.success
      if (!emailResult.success) {
        Logger.error('Failed to send team invite email', { error: emailResult.error })
        // Still return success for the invite creation, but log the email error
      }
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
      emailSent,
      linkOnly: skipEmail
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

    // Calculate credits from transactions (single source of truth)
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
        
        // Get total allocated from CreditTransaction records (single source of truth)
        const totalAllocated = await getTeamInviteTotalAllocated(typedInvite.id)
        const remainingCredits = await getTeamInviteRemainingCredits(typedInvite.id)
        
        // For pending invites (no transactions yet), fall back to creditsAllocated from invite
        const creditsAllocated = totalAllocated > 0 ? totalAllocated : typedInvite.creditsAllocated
        const creditsUsed = creditsAllocated - remainingCredits
        
        // Detect if invite was revoked: expiresAt was set to before createdAt (impossible naturally)
        // This happens when admin manually revokes an invite
        const isRevoked = typedInvite.expiresAt < typedInvite.createdAt
        
        return {
          id: typedInvite.id,
          email: typedInvite.email,
          firstName: typedInvite.firstName,
          token: typedInvite.token,
          expiresAt: typedInvite.expiresAt,
          usedAt: typedInvite.usedAt,
          creditsAllocated,
          creditsUsed: Math.max(0, creditsUsed), // Ensure non-negative
          creditsRemaining: remainingCredits,
          createdAt: typedInvite.createdAt,
          contextId: typedInvite.context?.id,
          contextName: typedInvite.context?.name,
          isRevoked
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
