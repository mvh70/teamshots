import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { withCompanyPermission } from '@/lib/permissions'
import { getCompanyCreditBalance, getTeamInviteRemainingCredits } from '@/lib/credits'
import { PRICING_CONFIG } from '@/config/pricing'

export async function POST(request: NextRequest) {
  try {
    // Check permission to invite team members
    const permissionCheck = await withCompanyPermission(
      request,
      'company.invite_members'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    const { email, creditsAllocated = PRICING_CONFIG.team.defaultInviteCredits } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate credits allocation
    const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration
    if (creditsAllocated % creditsPerGeneration !== 0) {
      return NextResponse.json({ 
        error: `Credits allocated must be a multiple of ${creditsPerGeneration} (credits per generation)`,
        errorCode: 'INVALID_CREDIT_ALLOCATION'
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

    // Check if company has an active context
    const company = await prisma.company.findUnique({
      where: { id: user.person.company.id },
      include: { activeContext: true }
    })

    if (!company?.activeContext) {
      return NextResponse.json({ 
        error: 'Company must have an active context before inviting team members. Please create and set a company context first.',
        errorCode: 'NO_ACTIVE_CONTEXT',
        helpUrl: '/app/contexts'
      }, { status: 400 })
    }

    // Check if company has sufficient credits
    const companyCredits = await getCompanyCreditBalance(company.id)
    if (companyCredits < creditsAllocated) {
      return NextResponse.json({ 
        error: `Insufficient company credits. Available: ${companyCredits}, Required: ${creditsAllocated}`,
        errorCode: 'INSUFFICIENT_COMPANY_CREDITS',
        availableCredits: companyCredits,
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
        companyId: user.person.company.id,
        token,
        expiresAt,
        creditsAllocated,
        contextId: company.activeContext?.id
      }
    })

    // Send email with invite link
    const baseUrl = process.env.NEXTAUTH_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const inviteLink = `${baseUrl}/invite/${token}`
    
    const emailResult = await sendTeamInviteEmail({
      email: teamInvite.email,
      companyName: company.name,
      inviteLink,
      creditsAllocated: teamInvite.creditsAllocated,
      locale: user.locale as 'en' | 'es' || 'en'
    })

    if (!emailResult.success) {
      console.error('Failed to send team invite email:', emailResult.error)
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
    console.error('Error creating team invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check permission to view team invites
    const permissionCheck = await withCompanyPermission(
      request,
      'company.view'
    )
    
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck // Return error response
    }
    
    const { session } = permissionCheck

    // Get user's company invites
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: {
              include: {
                teamInvites: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        }
      }
    })

    if (!user?.person?.company) {
      // User is not part of a company yet, return empty response
      return NextResponse.json({
        invites: []
      })
    }

    // Calculate credits used for each invite
    const invitesWithCredits = await Promise.all(
      user.person.company.teamInvites.map(async (invite) => {
        const remainingCredits = await getTeamInviteRemainingCredits(invite.id)
        const creditsUsed = invite.creditsAllocated - remainingCredits
        return {
          ...invite,
          creditsUsed,
          creditsRemaining: remainingCredits
        }
      })
    )

    return NextResponse.json({
      invites: invitesWithCredits
    })

  } catch (error) {
    console.error('Error fetching team invites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
