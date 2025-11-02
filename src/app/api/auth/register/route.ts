import { NextRequest, NextResponse } from 'next/server'
import { internal, badRequest } from '@/lib/api-response'
import { Logger } from '@/lib/logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    Logger.info('1. Starting registration...')
    Logger.debug('2. Request object', { type: typeof request, present: !!request })
    Logger.debug('3. Request headers', { type: typeof request?.headers, present: !!request?.headers })
    
    const body = await request.json()
    Logger.debug('4. Body parsed successfully')

    // Lazy load ALL dependencies to avoid build-time issues
    Logger.info('5. Loading dependencies...')
    const [
      bcrypt,
      { prisma },
      { verifyOTP },
      { createTeamVerificationRequest },
      { registrationSchema }
    ] = await Promise.all([
      import('bcryptjs').then(m => { Logger.debug('  - bcrypt loaded'); return m.default; }),
      import('@/lib/prisma').then(m => { Logger.debug('  - prisma loaded'); return m; }),
      import('@/domain/auth/otp').then(m => { Logger.debug('  - otp loaded'); return m; }),
      import('@/domain/auth/team-verification').then(m => { Logger.debug('  - team-verification loaded'); return m; }),
      import('@/lib/validation').then(m => { Logger.debug('  - validation loaded'); return m; })
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

    // Verify OTP
    Logger.info('9. Verifying OTP...')
    const isOTPValid = await verifyOTP(email, otpCode)
    Logger.debug('10. OTP verification result', { isOTPValid })
    
    if (!isOTPValid) {
      return NextResponse.json(
        badRequest('OTP_INVALID', 'auth.signup.Invalid OTP', 'Invalid or expired OTP'),
        { status: 400 }
      )
    }

    // Check if user already exists
    Logger.info('11. Checking existing user...')
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    Logger.debug('12. Existing user check complete')

    if (existingUser) {
      // User may have been created via Stripe webhook during checkout.
      // Since OTP is verified, safely set password and ensure a Person exists/linked.
      Logger.info('Existing user found; updating credentials and linking person')
      const hashedPasswordExisting = await bcrypt.hash(password, 12)
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

    // Hash password
    Logger.info('13. Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 12)
    Logger.debug('14. Password hashed')

    // Check if there's an existing person record from invite acceptance
    Logger.info('15. Checking existing person...')
    const existingPerson = await prisma.person.findFirst({
      where: { email },
      include: {
        team: true
      }
    })
    Logger.debug('16. Existing person check complete')

    // Determine initial role based on existing person/invite
    const initialRole = existingPerson?.teamId ? 'team_member' : 'user'

    // Create user with correct role
    Logger.info('17. Creating user...')
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: initialRole,
        locale,
      }
    })
    Logger.info('18. User created', { userId: user.id })

    let person
    let teamId = null

    if (existingPerson && !existingPerson.userId) {
      Logger.info('19. Linking existing person...')
      // Link existing person (from invite) to new user
      person = await prisma.person.update({
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
      
      teamId = existingPerson.teamId
      
      // Link the invite to the user
      const invite = await prisma.teamInvite.findFirst({
        where: { 
          email,
          usedAt: { not: null }
        }
      })
      
      if (invite) {
        await prisma.teamInvite.update({
          where: { id: invite.id },
          data: { convertedUserId: user.id }
        })
      }
      Logger.info('20. Person linked')
    } else {
      Logger.info('19. Creating new person...')
      // Create new person record
      person = await prisma.person.create({
        data: {
          firstName,
          lastName: lastName || null,
          email,
          userId: user.id,
        }
      })
      Logger.info('20. Person created', { personId: person.id })
    }

    // Handle team registration (only if not from invite)
    if (userType === 'team' && teamWebsite && !teamId) {
      Logger.info('21. Creating team...')
      const teamResult = await createTeamVerificationRequest(
        email,
        teamWebsite,
        user.id
      )

      if (teamResult.success && teamResult.teamId) {
        teamId = teamResult.teamId
        
        // Update person with team link
        await prisma.person.update({
          where: { id: person.id },
          data: { teamId }
        })
        
        // Update user role to team_admin since they created the team
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'team_admin' }
        })
        
        Logger.info('22. team created', { teamId })
      } else {
        return NextResponse.json(
          badRequest('team_CREATION_FAILED', 'auth.signup.Registration failed', teamResult.error || 'Failed to create team'),
          { status: 400 }
        )
      }
    }

    // Free trial grant (idempotent)
    try {
      const hasFreeGrant = await prisma.creditTransaction.findFirst({
        where: { userId: user.id, type: 'free_grant' }
      })
      if (!hasFreeGrant) {
        await prisma.$transaction(async (tx) => {
          const freePlanTier = userType === 'team' ? 'pro' : 'individual'
          // Get free credits from pricing config
          const { PRICING_CONFIG } = await import('@/config/pricing')
          const freeCredits = userType === 'team' 
            ? PRICING_CONFIG.freeTrial.pro 
            : PRICING_CONFIG.freeTrial.individual
          
          // If user has a team (created during signup), assign credits to team
          // Otherwise assign to userId
          const personWithTeam = await tx.person.findUnique({
            where: { userId: user.id },
            select: { teamId: true }
          })
          
          await tx.creditTransaction.create({
            data: {
              userId: user.id,
              teamId: personWithTeam?.teamId || undefined, // Assign to team if exists
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
        })
      }
    } catch (e) {
      Logger.error('Free trial grant failed', { error: e instanceof Error ? e.message : String(e) })
    }

    // Grant default package on signup (idempotent)
    try {
      const { PRICING_CONFIG } = await import('@/config/pricing')
      const defaultPackageId = PRICING_CONFIG.defaultSignupPackage
      
      type PrismaWithUserPackage = typeof prisma & { userPackage: { findFirst: (...args: unknown[]) => Promise<unknown>; create: (...args: unknown[]) => Promise<unknown> } }
      const prismaEx = prisma as unknown as PrismaWithUserPackage
      
      const hasPackage = await prismaEx.userPackage.findFirst({
        where: { userId: user.id, packageId: defaultPackageId }
      })
      
      if (!hasPackage) {
        await prismaEx.userPackage.create({
          data: {
            userId: user.id,
            packageId: defaultPackageId,
            purchasedAt: new Date()
          }
        })
        Logger.info('Default package granted', { userId: user.id, packageId: defaultPackageId })
      }
    } catch (e) {
      Logger.error('Default package grant failed', { error: e instanceof Error ? e.message : String(e) })
    }

    Logger.info('23. Registration complete!')
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