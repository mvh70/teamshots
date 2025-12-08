import { NextRequest, NextResponse } from 'next/server'
import { sendOTPVerificationEmail } from '@/domain/auth/otp'
import { prisma } from '@/lib/prisma'
import { badRequest, internal, ok } from '@/lib/api-response'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { Logger } from '@/lib/logger'
import { SecurityLogger } from '@/lib/security-logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json(badRequest('INVALID_INPUT', 'errors.invalidInput', 'Email is required'), { status: 400 })
    }

    // SECURITY: Multi-layer rate limiting to prevent OTP spam
    // Layer 1: IP-based rate limiting (3 OTP sends per 5 minutes per IP)
    const ipIdentifier = await getRateLimitIdentifier(request, 'otp')
    const ipRateLimit = await checkRateLimit(ipIdentifier, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.window)

    if (!ipRateLimit.success) {
      await SecurityLogger.logSuspiciousActivity(
        email,
        'otp_ip_rate_limit_exceeded',
        {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      )
      return NextResponse.json(
        { error: 'Too many OTP requests from your location. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipRateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    // Layer 2: Email-based rate limiting (5 OTP sends per 30 minutes per email)
    // This prevents abuse targeting specific email addresses
    const emailIdentifier = `otp_email:${email}`
    const emailRateLimit = await checkRateLimit(emailIdentifier, 5, 1800) // 5 attempts / 30 min

    if (!emailRateLimit.success) {
      await SecurityLogger.logSuspiciousActivity(
        email,
        'otp_email_rate_limit_exceeded',
        {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      )
      return NextResponse.json(
        { error: 'Too many OTP requests for this email address. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((emailRateLimit.reset - Date.now()) / 1000)) }}
      )
    }

    // Layer 3: Database-level throttle (one code per 60 seconds per email)
    // This ensures actual OTP records aren't created too frequently
    // Increased from 30s to 60s for better spam prevention
    const last = await prisma.oTP.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' as const },
    })

    if (last) {
      const timeSinceLastOtp = Date.now() - new Date(last.createdAt as unknown as string).getTime()
      const throttleMs = 60 * 1000 // 60 seconds

      if (timeSinceLastOtp < throttleMs) {
        const wait = Math.ceil((throttleMs - timeSinceLastOtp) / 1000)

        // Log if this is happening frequently (potential spam)
        if (timeSinceLastOtp < 10 * 1000) { // Less than 10 seconds
          await SecurityLogger.logSuspiciousActivity(
            email,
            'otp_rapid_requests',
            {
              timeSinceLastMs: timeSinceLastOtp,
              ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
            }
          )
        }

        return NextResponse.json(
          { ...ok(undefined, 'OTP_THROTTLED', 'errors.otpThrottled'), throttled: true, wait },
          { status: 200 }
        )
      }
    }

    // Layer 4: Global hourly limit per email domain (prevent domain abuse)
    // Check if this email domain is sending excessive OTPs across all addresses
    const emailDomain = email.split('@')[1]
    if (emailDomain) {
      const domainIdentifier = `otp_domain:${emailDomain}`
      const domainRateLimit = await checkRateLimit(domainIdentifier, 50, 3600) // 50 per hour per domain

      if (!domainRateLimit.success) {
        await SecurityLogger.logSuspiciousActivity(
          email,
          'otp_domain_rate_limit_exceeded',
          {
            domain: emailDomain,
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
          }
        )
        return NextResponse.json(
          { error: 'Too many OTP requests from this email domain. Please contact support if this is an error.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((domainRateLimit.reset - Date.now()) / 1000)) }}
        )
      }
    }

    // SECURITY: Always return success to prevent user enumeration
    // If user exists, we'll handle it during registration, not here

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
