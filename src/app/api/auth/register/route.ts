import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyOTP } from '@/lib/otp'
import { createCompanyVerificationRequest } from '@/lib/company-verification'

export async function POST(request: NextRequest) {
  try {
    const { 
      email, 
      password, 
      firstName, 
      userType, 
      companyWebsite, 
      otpCode,
      locale = 'en'
    } = await request.json()

    // Validate required fields
    if (!email || !password || !firstName || !otpCode) {
      return NextResponse.json(
        { error: 'Email, password, first name, and OTP code are required' },
        { status: 400 }
      )
    }

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

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'user',
        locale,
      }
    })

    // Create person record
    const person = await prisma.person.create({
      data: {
        firstName,
        email,
        userId: user.id,
      }
    })

    let companyId = null

    // Handle company registration
    if (userType === 'company' && companyWebsite) {
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
