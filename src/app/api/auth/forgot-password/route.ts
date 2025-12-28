import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, internal, ok } from '@/lib/api-response'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { Logger } from '@/lib/logger'
import { generatePasswordResetToken } from '@/domain/auth/password-reset'
import { sendPasswordResetEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Input validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (same as OTP to prevent abuse)
    const identifier = await getRateLimitIdentifier(request, 'forgot-password')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.window)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        badRequest('INVALID_INPUT', 'errors.invalidInput', validationResult.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const { email } = validationResult.data
    const normalizedEmail = email.toLowerCase()

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, password: true },
    })

    // SECURITY: Always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      Logger.info('Password reset requested for non-existent user', { email: normalizedEmail })
      // Still return success to prevent user enumeration
      return NextResponse.json(ok({}, 'PASSWORD_RESET_SENT', 'Password reset email sent'))
    }

    // Check if user has a password set
    if (!user.password) {
      Logger.info('Password reset requested for user without password', { email: normalizedEmail, userId: user.id })
      // Still return success but don't send email (user should use password setup flow)
      return NextResponse.json(ok({}, 'PASSWORD_RESET_SENT', 'Password reset email sent'))
    }

    // Generate password reset token
    const token = await generatePasswordResetToken(normalizedEmail)

    // Construct reset link
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const resetLink = `${protocol}://${host}/auth/reset-password?token=${token}`

    // Get user locale (default to 'en' if not set)
    const locale = (request.headers.get('accept-language')?.split(',')[0]?.split('-')[0] as 'en' | 'es') || 'en'

    // Send password reset email
    const emailResult = await sendPasswordResetEmail({
      email: user.email,
      resetLink,
      locale,
    })

    if (!emailResult.success) {
      Logger.error('Failed to send password reset email', { 
        email: normalizedEmail,
        error: emailResult.error 
      })
      return NextResponse.json(
        internal('Failed to send reset email', 'errors.emailFailed'),
        { status: 500 }
      )
    }

    Logger.info('Password reset email sent successfully', { 
      email: normalizedEmail,
      userId: user.id 
    })

    return NextResponse.json(ok({}, 'PASSWORD_RESET_SENT', 'Password reset email sent'))
  } catch (error) {
    Logger.error('Error in forgot-password endpoint', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}

