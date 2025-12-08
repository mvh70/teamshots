import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/domain/auth/otp'
import { badRequest, ok, internal } from '@/lib/api-response'
import { Logger } from '@/lib/logger'
import { z } from 'zod'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { SecurityLogger } from '@/lib/security-logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

// Input validation schema
const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required').max(255, 'Email too long'),
  code: z.string().min(4, 'OTP code must be at least 4 characters').max(10, 'OTP code too long').regex(/^\d+$/, 'OTP code must contain only digits')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input with Zod schema
    const validationResult = verifyOTPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        badRequest('INVALID_INPUT', 'errors.invalidInput', validationResult.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const { email, code } = validationResult.data

    // SECURITY: Rate limiting to prevent brute-force attacks on OTP codes
    // 5 attempts per 5 minutes per IP+email combination
    const identifier = await getRateLimitIdentifier(request, `otp_verify:${email}`)
    const rateLimit = await checkRateLimit(identifier, 5, 300) // 5 attempts / 5 min

    if (!rateLimit.success) {
      // Log suspicious activity when rate limit exceeded
      await SecurityLogger.logSuspiciousActivity(
        email,
        'otp_verify_rate_limit_exceeded',
        {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      )

      return NextResponse.json(
        badRequest(
          'RATE_LIMIT_EXCEEDED',
          'errors.rateLimitExceeded',
          'Too many verification attempts. Please request a new code.'
        ),
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000))
          }
        }
      )
    }

    const result = await verifyOTP(email, code)

    // Log failed attempts for security monitoring
    if (!result.success) {
      await SecurityLogger.logFailedLogin(email, 'otp_invalid', {
        reason: result.reason,
        codePrefix: code.substring(0, 2) + '****' // Partial code for debugging
      })
    }

    const isValid = result.success

    if (isValid) {
      return NextResponse.json(ok(undefined, 'OTP_VALID', 'auth.signup.verifyCode'))
    } else {
      return NextResponse.json(badRequest('OTP_INVALID', 'errors.otpInvalid', 'Invalid or expired OTP'), { status: 400 })
    }
  } catch (error) {
    Logger.error('Error in OTP verify endpoint', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}
