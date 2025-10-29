import { NextRequest, NextResponse } from 'next/server'
import { sendOTPVerificationEmail } from '@/domain/auth/otp'
import { prisma } from '@/lib/prisma'
import { badRequest, internal, ok } from '@/lib/api-response'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { Logger } from '@/lib/logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = await getRateLimitIdentifier(request, 'otp')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.window)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }}
      )
    }
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json(badRequest('INVALID_INPUT', 'errors.invalidInput', 'Email is required'), { status: 400 })
    }

    // SECURITY: Always return success to prevent user enumeration
    // If user exists, we'll handle it during registration, not here

    // Simple server-side throttle: one code per 30 seconds per email
    const last = await prisma.oTP.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' as const },
    })
    if (last && Date.now() - new Date(last.createdAt as unknown as string).getTime() < 30 * 1000) {
      const wait = Math.ceil((30 * 1000 - (Date.now() - new Date(last.createdAt as unknown as string).getTime())) / 1000)
      return NextResponse.json({ ...ok(undefined, 'OTP_THROTTLED', 'errors.otpThrottled'), throttled: true, wait }, { status: 200 })
    }

    const success = await sendOTPVerificationEmail(email, locale || 'en')

    if (success) {
      return NextResponse.json(ok(undefined, 'OTP_SENT', 'auth.signup.newCodeSent'))
    } else {
      return NextResponse.json(internal('Failed to send OTP email', 'errors.otpSendFailed'), { status: 500 })
    }
  } catch (error) {
    Logger.error('Error in OTP send endpoint', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}
