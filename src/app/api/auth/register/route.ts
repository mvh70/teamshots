import { NextRequest, NextResponse } from 'next/server'
import { internal, badRequest } from '@/lib/api-response'
import { Logger } from '@/lib/logger'
import { getRequestDomain, getSignupTypeFromDomain } from '@/lib/domain'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    Logger.info('1. Starting registration...')
    Logger.debug('2. Request object', { type: typeof request, present: !!request })
    Logger.debug('3. Request headers', { type: typeof request?.headers, present: !!request?.headers })
    
    // Rate limiting for registration endpoint
    const { checkRateLimit, getRateLimitIdentifier } = await import('@/lib/rate-limit')
    const { RATE_LIMITS } = await import('@/config/rate-limit-config')
    const { SecurityLogger } = await import('@/lib/security-logger')
    
    const identifier = await getRateLimitIdentifier(request, 'register')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.register.limit, RATE_LIMITS.register.window)
    
    if (!rateLimit.success) {
      await SecurityLogger.logRateLimitExceeded(identifier)
      return NextResponse.json(
        { error: 'Registration rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }
    
    const body = await request.json()
    Logger.debug('4. Body parsed successfully')

    // Lazy load ALL dependencies to avoid build-time issues
    Logger.info('5. Loading dependencies...')
    const [
      bcrypt,
      { prisma },
      { verifyOTP },
      { registrationSchema },
      { captureServerEvent },
      { sendAdminSignupNotificationEmail }
    ] = await Promise.all([
      import('bcryptjs').then(m => { Logger.debug('  - bcrypt loaded'); return m.default; }),
      import('@/lib/prisma').then(m => { Logger.debug('  - prisma loaded'); return m; }),
      import('@/domain/auth/otp').then(m => { Logger.debug('  - otp loaded'); return m; }),
      import('@/lib/validation').then(m => { Logger.debug('  - validation loaded'); return m; }),
      import('@/lib/analytics/server').then(m => { Logger.debug('  - analytics loaded'); return m; }),
      import('@/lib/email').then(m => { Logger.debug('  - email helpers loaded'); return m; })
    ])
    Logger.info('6. All dependencies loaded')

    // Validate with Zod
    Logger.info('7. Validating input...')
    const validationResult = registrationSchema.safeParse(body)
    if (!validationResult.success) {
      Logger.warn('Validation failed', { issues: validationResult.error.issues })
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues.map(i => ({ 
            field: i.path[0], 
            message: i.message,
            code: i.code 
          }))
        },
        { status: 400 }
      )
    }
    Logger.info('8. Validation passed')

    const { 
      email, 
      password, 
      firstName, 
      lastName,
      userType = 'individual', 
      teamWebsite, 
      otpCode,
      locale
    } = validationResult.data

    // Domain-based signup restriction validation
    Logger.info('9. Validating domain restrictions...')
    const domain = getRequestDomain(request)
    const domainRestrictedUserType = getSignupTypeFromDomain(domain)

    if (domainRestrictedUserType && userType !== domainRestrictedUserType) {
      Logger.warn('Domain restriction violation', {
        domain,
        domainRestrictedUserType,
        requestedUserType: userType
      })
      return NextResponse.json(
        badRequest('DOMAIN_RESTRICTION_VIOLATION', 'auth.signup.Domain restriction violation', `This domain only allows ${domainRestrictedUserType} subscription signup`),
        { status: 400 }
      )
    }

    // Verify OTP
    Logger.info('10. Verifying OTP...')
    const otpResult = await verifyOTP(email, otpCode)
    Logger.debug('11. OTP verification result', otpResult)

    if (!otpResult.success) {
      const errorMessages = {
        invalid_code: 'The verification code you entered is incorrect. Please check and try again.',
        expired: 'The verification code has expired. Please request a new code.',
        already_verified: 'This verification code has already been used. Please request a new code.',
        technical_error: 'Oops! Something went wrong. Please try again, and if it keeps happening, let us know.'
      }

      return NextResponse.json(
        badRequest('OTP_INVALID', 'auth.signup.Invalid OTP', errorMessages[otpResult.reason]),
        { status: 400 }
      )
    }

    // Batch existence check for user and person
    Logger.info('12. Checking existing user and person...')
    const existingRecords = await prisma.$queryRaw`
      SELECT
        u.id as "userId", u.email as "userEmail", u.role as "userRole", u.locale as "userLocale",
        p.id as "personId", p."firstName", p."lastName", p."userId" as "personUserId", p."teamId",
        t.id as "teamId", t.name as "teamName"
      FROM "User" u
      FULL OUTER JOIN "Person" p ON u.email = p.email
      LEFT JOIN "Team" t ON p."teamId" = t.id
      WHERE u.email = ${email} OR p.email = ${email}
      LIMIT 1
    ` as Array<{
      userId: string | null
      userEmail: string | null
      userRole: string | null
      userLocale: string | null
      personId: string | null
      firstName: string | null
      lastName: string | null
      personUserId: string | null
      teamId: string | null
      teamName: string | null
    }>
    Logger.debug('13. Batched existence check complete')

    const existingUser = existingRecords[0]?.userId ? {
      id: existingRecords[0].userId,
      email: existingRecords[0].userEmail,
      role: existingRecords[0].userRole,
      locale: existingRecords[0].userLocale
    } : null

    const existingPerson = existingRecords[0]?.personId ? {
      id: existingRecords[0].personId,
      firstName: existingRecords[0].firstName,
      lastName: existingRecords[0].lastName,
      userId: existingRecords[0].personUserId,
      teamId: existingRecords[0].teamId,
      team: existingRecords[0].teamId ? { id: existingRecords[0].teamId, name: existingRecords[0].teamName } : null
    } : null

    if (existingUser) {
      // User may have been created via Stripe webhook during checkout.
      // Since OTP is verified, safely set password and ensure a Person exists/linked.
      Logger.info('Existing user found; updating credentials and linking person')
      const hashedPasswordExisting = await bcrypt.hash(password, 13)
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPasswordExisting }
      })
      // Ensure person exists
      let person = await prisma.person.findFirst({ where: { userId: updated.id } })
      if (!person) {
        person = await prisma.person.create({
          data: { firstName, lastName: lastName || null, email, userId: updated.id }
        })
      }
      Logger.info('User updated and person ensured')
      return NextResponse.json({
        success: true,
        user: { id: updated.id, email: updated.email, role: updated.role, locale: updated.locale },
        person: { id: person.id, firstName: person.firstName },
        teamId: person.teamId ?? null,
      })
    }

    // Hash password with increased cost factor for better security
    // Cost factor 13 provides good security while maintaining reasonable performance
    Logger.info('14. Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 13)
    Logger.debug('15. Password hashed')

    // Determine initial role based on existing person/invite or userType
    // If userType is 'team' and no existing person, set role to 'team_admin' so they can set up their team
    const initialRole = existingPerson?.teamId 
      ? 'team_member' 
      : (userType === 'team' ? 'team_admin' : 'user')

    // Create user with correct role
    Logger.info('18. Creating user...')
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: initialRole,
        locale,
      }
    })
    Logger.info('19. User created', { userId: user.id, role: initialRole })

    let person
    let teamId = null

    if (existingPerson && !existingPerson.userId) {
      Logger.info('20. Linking existing person...')
      // Link existing person (from invite) to new user and convert invite in single transaction
      const result = await prisma.$transaction(async (tx) => {
        // Link person to user
        const linkedPerson = await tx.person.update({
          where: { id: existingPerson.id },
          data: {
            userId: user.id,
            firstName,
            lastName: lastName || null
          },
          include: {
            team: true
          }
        })

        // Find and convert the invite atomically
        const invite = await tx.teamInvite.findFirst({
          where: {
            email,
            usedAt: { not: null }
          }
        })

        if (invite) {
          await tx.teamInvite.update({
            where: { id: invite.id },
            data: { convertedUserId: user.id }
          })
        }

        return linkedPerson
      })

      person = result
      teamId = existingPerson.teamId
      Logger.info('21. Person linked')
    } else {
      Logger.info('20. Creating new person...')
      // Create new person record
      person = await prisma.person.create({
        data: {
          firstName,
          lastName: lastName || null,
          email,
          userId: user.id,
        }
      })
      Logger.info('21. Person created', { personId: person.id })
    }

    // Handle team registration (only if not from invite)
    if (userType === 'team' && teamWebsite && !teamId) {
      // For team signups, just set the user role to team_admin
      // Team creation will happen later when they complete the team setup form
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'team_admin' }
      })

      Logger.info('22. User marked as team_admin, team creation deferred')
    }

    // Consolidated signup grants (free trial + default package) in single transaction
    try {
      await prisma.$transaction(async (tx) => {
        const { PRICING_CONFIG } = await import('@/config/pricing')
        const { PACKAGES_CONFIG } = await import('@/config/packages')
        const defaultPackageId = PACKAGES_CONFIG.defaultPlanPackage
        const freePlanTier = userType === 'team' ? 'pro' : 'individual'
        const freeCredits = userType === 'team'
          ? PRICING_CONFIG.freeTrial.pro
          : PRICING_CONFIG.freeTrial.individual

        // Get person's team association for credit assignment
        const personWithTeam = await tx.person.findUnique({
          where: { userId: user.id },
          select: { teamId: true }
        })

        // Check existing grants in single query
        const [existingFreeGrant, existingPackage] = await Promise.all([
          tx.creditTransaction.findFirst({
            where: { userId: user.id, type: 'free_grant' }
          }),
          tx.userPackage.findFirst({
            where: { userId: user.id, packageId: defaultPackageId }
          })
        ])

        // Free trial grant (only if not already granted)
        if (!existingFreeGrant) {
          await tx.creditTransaction.create({
            data: {
              userId: user.id,
              teamId: personWithTeam?.teamId || undefined,
              credits: freeCredits,
              type: 'free_grant',
              description: 'Free trial credits',
              planTier: freePlanTier,
              planPeriod: 'free',
            }
          })

          type PrismaWithSubscriptionChange = typeof prisma & { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
          const txEx = tx as unknown as PrismaWithSubscriptionChange
          await txEx.subscriptionChange.create({
            data: {
              userId: user.id,
              planTier: freePlanTier,
              planPeriod: 'free',
              action: 'start',
            }
          })

          await tx.user.update({
            where: { id: user.id },
            data: { planTier: freePlanTier, planPeriod: 'free', freeTrialGrantedAt: new Date() }
          })

          Logger.info('Free trial granted', { userId: user.id, credits: freeCredits, planTier: freePlanTier })
        }

        // Default package grant (only if not already granted)
        if (!existingPackage) {
          await tx.userPackage.create({
            data: {
              userId: user.id,
              packageId: defaultPackageId,
              purchasedAt: new Date()
            }
          })
          Logger.info('Default package granted', { userId: user.id, packageId: defaultPackageId })
        }
      })
    } catch (e) {
      Logger.error('Signup grants failed', { error: e instanceof Error ? e.message : String(e) })
    }

    Logger.info('24. Registration complete!')
    const emailDomain = email.split('@')[1] ?? null

    const [analyticsResult, adminEmailResult] = await Promise.allSettled([
      captureServerEvent({
        event: 'user_signup',
        distinctId: user.id,
        properties: {
          user_type: userType,
          locale,
          has_team: Boolean(teamId),
          team_id: teamId,
          team_website: teamWebsite ?? null,
          email_domain: emailDomain,
          created_via_invite: Boolean(existingPerson),
        },
      }),
      sendAdminSignupNotificationEmail({
        email,
        firstName,
        lastName,
        userType,
        locale,
        teamId,
        teamWebsite: teamWebsite ?? null,
      })
    ])

    if (analyticsResult.status === 'rejected') {
      Logger.error('PostHog signup capture failed', {
        error: analyticsResult.reason instanceof Error ? analyticsResult.reason.message : String(analyticsResult.reason)
      })
    }

    if (adminEmailResult.status === 'rejected') {
      Logger.error('Admin signup email failed', {
        error: adminEmailResult.reason instanceof Error ? adminEmailResult.reason.message : String(adminEmailResult.reason)
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        locale: user.locale,
      },
      person: {
        id: person.id,
        firstName: person.firstName,
      },
      teamId,
    })

  } catch (error) {
    Logger.error('Error in registration endpoint', { error: error instanceof Error ? error.message : String(error) })
    if (error instanceof Error && error.stack) Logger.debug('Error stack', { stack: error.stack })
    return NextResponse.json(
      internal('Internal server error', 'auth.signup.Internal server error'),
      { status: 500 }
    )
  }
}