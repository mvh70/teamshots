import { NextRequest, NextResponse } from 'next/server'
import { internal, badRequest } from '@/lib/api-response'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('1. Starting registration...')
    console.log('2. Request object:', typeof request, !!request)
    console.log('3. Request headers:', typeof request?.headers, !!request?.headers)
    
    const body = await request.json()
    console.log('4. Body parsed successfully')

    // Lazy load ALL dependencies to avoid build-time issues
    console.log('5. Loading dependencies...')
    const [
      bcrypt,
      { prisma },
      { verifyOTP },
      { createCompanyVerificationRequest },
      { registrationSchema }
    ] = await Promise.all([
      import('bcryptjs').then(m => { console.log('  - bcrypt loaded'); return m.default; }),
      import('@/lib/prisma').then(m => { console.log('  - prisma loaded'); return m; }),
      import('@/lib/otp').then(m => { console.log('  - otp loaded'); return m; }),
      import('@/lib/company-verification').then(m => { console.log('  - company-verification loaded'); return m; }),
      import('@/lib/validation').then(m => { console.log('  - validation loaded'); return m; })
    ])
    console.log('6. All dependencies loaded')

    // Validate with Zod
    console.log('7. Validating input...')
    const validationResult = registrationSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.issues)
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
    console.log('8. Validation passed')

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
    console.log('9. Verifying OTP...')
    const isOTPValid = await verifyOTP(email, otpCode)
    console.log('10. OTP verification result:', isOTPValid)
    
    if (!isOTPValid) {
      return NextResponse.json(
        badRequest('OTP_INVALID', 'auth.signup.Invalid OTP', 'Invalid or expired OTP'),
        { status: 400 }
      )
    }

    // Check if user already exists
    console.log('11. Checking existing user...')
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    console.log('12. Existing user check complete')

    if (existingUser) {
      return NextResponse.json(
        badRequest('USER_EXISTS', 'auth.signup.accountExists', 'User already exists'),
        { status: 400 }
      )
    }

    // Hash password
    console.log('13. Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 12)
    console.log('14. Password hashed')

    // Check if there's an existing person record from invite acceptance
    console.log('15. Checking existing person...')
    const existingPerson = await prisma.person.findFirst({
      where: { email },
      include: {
        company: true
      }
    })
    console.log('16. Existing person check complete')

    // Determine initial role based on existing person/invite
    const initialRole = existingPerson?.companyId ? 'company_member' : 'user'

    // Create user with correct role
    console.log('17. Creating user...')
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: initialRole,
        locale,
      }
    })
    console.log('18. User created:', user.id)

    let person
    let companyId = null

    if (existingPerson && !existingPerson.userId) {
      console.log('19. Linking existing person...')
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
      console.log('20. Person linked')
    } else {
      console.log('19. Creating new person...')
      // Create new person record
      person = await prisma.person.create({
        data: {
          firstName,
          lastName: lastName || null,
          email,
          userId: user.id,
        }
      })
      console.log('20. Person created:', person.id)
    }

    // Handle company registration (only if not from invite)
    if (userType === 'company' && companyWebsite && !companyId) {
      console.log('21. Creating company...')
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
        console.log('22. Company created:', companyId)
      } else {
        return NextResponse.json(
          badRequest('COMPANY_CREATION_FAILED', 'auth.signup.Registration failed', companyResult.error || 'Failed to create company'),
          { status: 400 }
        )
      }
    }

    console.log('23. Registration complete!')
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
    console.error('Error in registration endpoint:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      internal('Internal server error', 'auth.signup.Internal server error'),
      { status: 500 }
    )
  }
}