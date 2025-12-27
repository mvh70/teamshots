import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { badRequest, internal, ok } from '@/lib/api-response'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { Logger } from '@/lib/logger'
import { verifyPasswordResetToken, consumePasswordResetToken } from '@/domain/auth/password-reset'

export const dynamic = 'force-dynamic'

// Input validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid token'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = await getRateLimitIdentifier(request, 'reset-password')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.window)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        badRequest('INVALID_INPUT', 'errors.invalidInput', validationResult.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const { token, password } = validationResult.data

    // Verify token
    const tokenResult = await verifyPasswordResetToken(token)
    if (!tokenResult.success) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'This link is invalid. Please request a new password reset link.',
        expired: 'This link has expired. Please request a new password reset link.',
        already_used: 'This link has already been used. Please sign in or request a new link.',
        technical_error: 'Something went wrong. Please try again.',
      }
      return NextResponse.json(
        badRequest('TOKEN_INVALID', 'auth.resetPassword.tokenInvalid', errorMessages[tokenResult.reason]),
        { status: 400 }
      )
    }

    const { email } = tokenResult

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, password: true },
    })

    if (!user) {
      Logger.error('User not found for password reset', { email })
      return NextResponse.json(
        badRequest('USER_NOT_FOUND', 'errors.userNotFound', 'User not found'),
        { status: 400 }
      )
    }

    // Check if user actually has a password to reset
    if (!user.password) {
      // Consume the token to prevent reuse
      await consumePasswordResetToken(token)
      Logger.warn('Password reset attempted for user without password', { email, userId: user.id })
      return NextResponse.json(
        badRequest('NO_PASSWORD_SET', 'auth.resetPassword.noPassword', 'No password set for this account. Please use the sign-in page.'),
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user with new password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    // Consume the token
    await consumePasswordResetToken(token)

    Logger.info('Password reset successfully', { userId: user.id, email })

    return NextResponse.json(ok({ email }, 'PASSWORD_RESET', 'auth.resetPassword.success'))
  } catch (error) {
    Logger.error('Error in reset-password endpoint', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}

// GET endpoint to verify token validity (for page load)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        badRequest('MISSING_TOKEN', 'errors.missingToken', 'Token is required'),
        { status: 400 }
      )
    }

    // Verify token
    const tokenResult = await verifyPasswordResetToken(token)
    if (!tokenResult.success) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'This link is invalid. Please request a new password reset link.',
        expired: 'This link has expired. Please request a new password reset link.',
        already_used: 'This link has already been used. Please sign in or request a new link.',
        technical_error: 'Something went wrong. Please try again.',
      }
      return NextResponse.json(
        badRequest('TOKEN_INVALID', 'auth.resetPassword.tokenInvalid', errorMessages[tokenResult.reason]),
        { status: 400 }
      )
    }

    // Check if user exists and has a password
    const user = await prisma.user.findUnique({
      where: { email: tokenResult.email.toLowerCase() },
      select: { id: true, password: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        badRequest('USER_NOT_FOUND', 'errors.userNotFound', 'User not found'),
        { status: 400 }
      )
    }

    if (!user.password) {
      return NextResponse.json(
        badRequest('NO_PASSWORD_SET', 'auth.resetPassword.noPassword', 'No password set for this account. Please use the sign-in page.'),
        { status: 400 }
      )
    }

    return NextResponse.json(ok({ email: user.email, valid: true }, 'TOKEN_VALID', 'Token is valid'))
  } catch (error) {
    Logger.error('Error verifying reset-password token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}

