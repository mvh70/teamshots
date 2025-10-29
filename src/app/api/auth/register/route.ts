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
      { createCompanyVerificationRequest },
      { registrationSchema }
    ] = await Promise.all([
      import('bcryptjs').then(m => { Logger.debug('  - bcrypt loaded'); return m.default; }),
      import('@/lib/prisma').then(m => { Logger.debug('  - prisma loaded'); return m; }),
      import('@/domain/auth/otp').then(m => { Logger.debug('  - otp loaded'); return m; }),
      import('@/domain/auth/company-verification').then(m => { Logger.debug('  - company-verification loaded'); return m; }),
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
      companyWebsite, 
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
        companyId: person.companyId ?? null,
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
        company: true
      }
    })
    Logger.debug('16. Existing person check complete')

    // Determine initial role based on existing person/invite
    const initialRole = existingPerson?.companyId ? 'company_member' : 'user'

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
    let companyId = null

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
          company: true
        }
      })
      
      companyId = existingPerson.companyId
      
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

    // Handle company registration (only if not from invite)
    if (userType === 'company' && companyWebsite && !companyId) {
      Logger.info('21. Creating company...')
      const companyResult = await createCompanyVerificationRequest(
        email,
        companyWebsite,
        user.id
      )

      if (companyResult.success && companyResult.companyId) {
        companyId = companyResult.companyId
        
        // Update person with company link
        await prisma.person.update({
          where: { id: person.id },
          data: { companyId }
        })
        Logger.info('22. Company created', { companyId })
      } else {
        return NextResponse.json(
          badRequest('COMPANY_CREATION_FAILED', 'auth.signup.Registration failed', companyResult.error || 'Failed to create company'),
          { status: 400 }
        )
      }
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
      companyId,
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