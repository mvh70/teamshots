import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { enforceInviteRateLimitWithBlocking } from '@/lib/rate-limit'
import { sendTeamInviteEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { getBaseUrl } from '@/lib/url'

export async function POST(request: NextRequest) {
  try {
    // Rate limit + temporary IP block for public invite validation
    const rate = await enforceInviteRateLimitWithBlocking(request, 'invite.validate')
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.blocked ? 'Too many attempts from this IP. Please try again later.' : 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find and validate invite
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        team: {
          include: {
          activeContext: true,
          admin: {
            select: {
              id: true,
              email: true,
              locale: true,
              person: {
                select: {
                  firstName: true
                }
              }
            }
          }
          }
        },
        context: true,
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    }

    const now = new Date()
    const isExpired = invite.expiresAt < now
    const isUsed = !!invite.usedAt

    // Helper function to send new invite email
    const sendNewInviteEmail = async (newToken: string) => {
      const baseUrl = getBaseUrl(request.headers)
      const inviteLink = `${baseUrl}/invite/${newToken}`
      
      // Get admin info for email
      const inviterFirstName = invite.team.admin.person?.firstName || 
                               invite.team.admin.email?.split('@')[0] || 
                               'Team Admin'

      // Use admin's locale for the email, default to English
      const adminLocale = (invite.team.admin as unknown as { locale?: string | null })?.locale || 'en'
      const emailLocale = (adminLocale === 'es' ? 'es' : 'en') as 'en' | 'es'

      return await sendTeamInviteEmail({
        email: invite.email,
        teamName: invite.team.name,
        inviteLink,
        creditsAllocated: invite.creditsAllocated,
        firstName: invite.firstName,
        inviterFirstName,
        locale: emailLocale
      })
    }

    // Check if invite has been previously accepted (person exists)
    // Use personId presence, not usedAt, to determine returning user
    if (invite.personId && invite.person) {
      // Check if person was revoked (teamId is null or different)
      if (invite.person.teamId !== invite.teamId) {
        // Revoked: show error message
        return NextResponse.json({ 
          error: 'This invite is not valid. Please contact your team admin for a new invite.',
          revoked: true
        }, { status: 403 })
      }

      // Person is still active - check expiration
      if (isExpired) {
        // Accepted/used and expired: send a new token
        // Update existing invite with new token and expiration (personId is unique, so we can't create a new one)
        const newToken = randomBytes(32).toString('hex')
        const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

        // Update the existing invite with new token and expiration
        // Don't reset usedAt - they already accepted, just need a fresh token
        await prisma.teamInvite.update({
          where: { id: invite.id },
          data: {
            token: newToken,
            expiresAt: newExpiresAt
          }
        })

        const emailResult = await sendNewInviteEmail(newToken)

        if (emailResult.success) {
          Logger.info('Auto-updated and sent new token for expired used invite', { 
            inviteId: invite.id,
            email: invite.email,
            personId: invite.personId,
            newToken: newToken.substring(0, 8) + '...'
          })

          return NextResponse.json({ 
            error: 'Invite has expired',
            expired: true,
            emailResent: true,
            message: 'A new invite link has been sent to your email. Check your inbox!'
          }, { status: 410 })
        } else {
          Logger.error('Failed to auto-resend expired used invite', { 
            inviteId: invite.id,
            email: invite.email,
            error: emailResult.error 
          })
          return NextResponse.json({ 
            error: 'Invite has expired. Please contact your team admin for a new invite.',
            expired: true,
            emailResent: false
          }, { status: 410 })
        }
      } else {
        // Accepted and not expired: redirect to invite-dashboard
        const adminPlanPeriod = (invite.team.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
        const isAdminOnFreePlan = adminPlanPeriod === 'free'

        return NextResponse.json({
          valid: true,
          invite: {
            email: invite.email,
            teamName: invite.team.name,
            creditsAllocated: invite.creditsAllocated,
            expiresAt: invite.expiresAt,
            hasActiveContext: Boolean(invite.context),
            personId: invite.person.id,
            firstName: invite.person.firstName,
            lastName: invite.person.lastName,
            contextId: invite.context?.id,
            isAdminOnFreePlan
          }
        })
      }
    }

    // Expired invite without a linked person: send a new token
    // This covers both never-accepted invites AND partially-completed accepts (usedAt set but personId null)
    if (isExpired && !invite.personId) {
      const newToken = randomBytes(32).toString('hex')
      const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

      // Update invite with new token and expiration, reset usedAt since person was never created
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: {
          token: newToken,
          expiresAt: newExpiresAt,
          usedAt: null // Reset usedAt since no person was created
        }
      })

      const emailResult = await sendNewInviteEmail(newToken)

      if (emailResult.success) {
        Logger.info('Auto-resent expired invite', { 
          inviteId: invite.id, 
          email: invite.email,
          newToken: newToken.substring(0, 8) + '...',
          hadPartialAccept: isUsed // Log if this was a partially completed accept
        })

        return NextResponse.json({ 
          error: 'Invite has expired',
          expired: true,
          emailResent: true,
          message: 'A new invite link has been sent to your email. Check your inbox!'
        }, { status: 410 })
      } else {
        Logger.error('Failed to auto-resend expired invite', { 
          inviteId: invite.id, 
          error: emailResult.error 
        })
        return NextResponse.json({ 
          error: 'Invite has expired. Please contact your team admin for a new invite.',
          expired: true,
          emailResent: false
        }, { status: 410 })
      }
    }

    // Check if team admin is on free plan
    const adminPlanPeriod = (invite.team.admin as unknown as { planPeriod?: string | null })?.planPeriod ?? null
    const isAdminOnFreePlan = adminPlanPeriod === 'free'

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        teamName: invite.team.name,
        creditsAllocated: invite.creditsAllocated,
        expiresAt: invite.expiresAt,
        hasActiveContext: Boolean(invite.context),
        contextId: invite.context?.id,
        firstName: invite.firstName,
        isAdminOnFreePlan,
        inviterFirstName: invite.team.admin.person?.firstName || invite.team.admin.email?.split('@')[0] || 'Team Admin'
      }
    })

  } catch (error) {
    Logger.error('Error validating invite', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
