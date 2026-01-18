import { NextRequest, NextResponse } from 'next/server'
import { prisma, Prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { createBulkInvites, ParsedRow } from '@/domain/team/bulk-invite'
import { sendTeamInviteEmail } from '@/lib/email'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'
import { getBaseUrl } from '@/lib/url'
import { isSeatsBasedTeam, canAddTeamMember } from '@/domain/pricing/seats'
import { getPackageConfig } from '@/domain/style/packages'

interface InviteData {
  email: string
  firstName: string
}

/**
 * POST /api/team/invites/bulk/confirm
 * Execute bulk import after preview confirmation
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission to invite team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.invite_members'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { session } = permissionCheck
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    const body = await request.json()
    const { invites, skipEmail = false } = body as {
      invites: InviteData[]
      skipEmail?: boolean
    }

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json(
        { error: 'No invites provided' },
        { status: 400 }
      )
    }

    // Validate invite data
    for (const invite of invites) {
      if (!invite.email || !invite.firstName) {
        return NextResponse.json(
          { error: 'Each invite must have email and firstName' },
          { status: 400 }
        )
      }
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
      return NextResponse.json(
        { error: getTranslation('api.errors.teamInvites.userNotInTeam', locale) },
        { status: 400 }
      )
    }

    const team = user.person.team

    // Check seats availability for seats-based teams
    const useSeatsModel = await isSeatsBasedTeam(team.id)
    if (useSeatsModel) {
      const seatCheck = await canAddTeamMember(team.id)
      if (seatCheck.totalSeats !== undefined && seatCheck.currentSeats !== undefined) {
        const availableSeats = seatCheck.totalSeats - seatCheck.currentSeats
        if (invites.length > availableSeats) {
          return NextResponse.json({
            error: getTranslation('api.errors.teamInvites.noAvailableSeats', locale, {
              current: seatCheck.currentSeats.toString(),
              total: seatCheck.totalSeats.toString()
            }),
            errorCode: 'NO_AVAILABLE_SEATS',
            seatsNeeded: invites.length,
            seatsAvailable: availableSeats
          }, { status: 400 })
        }
      }
    }

    // Determine context to use (same logic as single invite)
    const rawAdminPlanPeriod = (team?.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
    const adminPlanPeriod = rawAdminPlanPeriod === 'month' ? 'monthly' : rawAdminPlanPeriod === 'year' ? 'annual' : rawAdminPlanPeriod
    const isAdminOnFreePlan = adminPlanPeriod === 'free' || !adminPlanPeriod

    let contextToUse: typeof team.activeContext = null

    if (isAdminOnFreePlan) {
      // Get or create free package context
      const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })

      if (setting?.value) {
        contextToUse = await prisma.context.findUnique({
          where: { id: setting.value }
        })
      }

      if (!contextToUse) {
        try {
          const pkg = getPackageConfig('freepackage')
          const defaultSettings = pkg.defaultSettings
          const serializedSettings = pkg.persistenceAdapter.serialize(defaultSettings) as Record<string, unknown>
          serializedSettings.stylePreset = pkg.defaultPresetId

          const newContext = await prisma.context.create({
            data: {
              name: 'Free Package Style',
              settings: serializedSettings as Prisma.InputJsonValue,
            },
            select: { id: true },
          })

          await prisma.appSetting.upsert({
            where: { key: 'freePackageStyleId' },
            update: { value: newContext.id },
            create: { key: 'freePackageStyleId', value: newContext.id },
          })

          contextToUse = await prisma.context.findUnique({
            where: { id: newContext.id }
          })

          Logger.info('Auto-created free package context for bulk invitation', {
            contextId: newContext.id,
            teamId: team.id
          })
        } catch (error) {
          Logger.error('Failed to auto-create free package context', {
            error: error instanceof Error ? error.message : String(error),
            teamId: team.id
          })
        }
      }
    } else {
      contextToUse = team?.activeContext ?? null
    }

    if (!contextToUse) {
      return NextResponse.json({
        error: getTranslation('api.errors.teamInvites.noActiveContext', locale),
        errorCode: 'NO_ACTIVE_CONTEXT',
        helpUrl: '/app/contexts'
      }, { status: 400 })
    }

    // Build base URL
    const baseUrl = getBaseUrl(request.headers)

    // Convert to ParsedRow format
    const parsedRows: ParsedRow[] = invites.map((inv, idx) => ({
      email: inv.email.toLowerCase().trim(),
      firstName: inv.firstName.trim(),
      rowNumber: idx + 1
    }))

    // Create bulk invites
    const result = await createBulkInvites(
      team.id,
      contextToUse.id,
      parsedRows,
      baseUrl
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Send emails if not skipped
    let emailsSent = 0
    let emailsFailed = 0

    if (!skipEmail) {
      const inviterName = session.user.name || ''
      const inviterFirstName = inviterName.split(' ')[0] || inviterName || 'Team Admin'

      for (const invite of result.invites) {
        try {
          const emailResult = await sendTeamInviteEmail({
            email: invite.email,
            teamName: team.name || 'Team',
            inviteLink: invite.inviteLink,
            creditsAllocated: 10, // Fixed allocation
            firstName: invite.firstName,
            inviterFirstName,
            locale: user.locale as 'en' | 'es' || 'en'
          })

          if (emailResult.success) {
            emailsSent++
          } else {
            emailsFailed++
            Logger.error('Failed to send bulk invite email', {
              email: invite.email,
              error: emailResult.error
            })
          }
        } catch (error) {
          emailsFailed++
          Logger.error('Error sending bulk invite email', {
            email: invite.email,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      emailsSent,
      emailsFailed,
      linkOnly: skipEmail,
      invites: result.invites.map(inv => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        inviteLink: inv.inviteLink
      }))
    })

  } catch (error) {
    Logger.error('Error in bulk invite confirmation', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to create invites' },
      { status: 500 }
    )
  }
}
