import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyOTP } from '@/lib/otp'
import { createCompanyVerificationRequest } from '@/lib/company-verification'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { registrationSchema } from '@/lib/validation'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Guard against build-time execution
    if (!request || typeof request.json !== 'function') {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Rate limiting - only after we have the request body
    const { checkRateLimit, getRateLimitIdentifier } = await import('@/lib/rate-limit')
    
    let identifier = 'register:unknown'
    try {
      identifier = getRateLimitIdentifier(request, 'register')
    } catch (error) {
      // If rate limit identifier fails, use email from body as fallback
      identifier = `register:${body.email || 'unknown'}`
    }
    
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.register.limit, RATE_LIMITS.register.window)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    // Validate with Zod (re-enabled with basic requirements)
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
    const isOTPValid = await verifyOTP(email, otpCode)
    if (!isOTPValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if there's an existing person record from invite acceptance
    const existingPerson = await prisma.person.findFirst({
      where: { email },
      include: {
        company: true
      }
    })

    // Determine initial role based on existing person/invite
    const initialRole = existingPerson?.companyId ? 'company_member' : 'user'

    // Create user with correct role
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: initialRole,
        locale,
      }
    })

    let person
    let companyId = null

    if (existingPerson && !existingPerson.userId) {
      // Link existing person (from invite) to new user
      person = await prisma.person.update({
        where: { id: existingPerson.id },
        data: {
          userId: user.id,
          firstName, // Update with provided name
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
    } else {
      // Create new person record
      person = await prisma.person.create({
        data: {
          firstName,
          lastName: lastName || null,
          email,
          userId: user.id,
        }
      })
    }

    // Handle company registration (only if not from invite)
    if (userType === 'company' && companyWebsite && !companyId) {
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
      } else {
        return NextResponse.json(
          { error: companyResult.error || 'Failed to create company' },
          { status: 400 }
        )
      }
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
      companyId,
    })

  } catch (error) {
    console.error('Error in registration endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}