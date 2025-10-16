import { NextRequest, NextResponse } from 'next/server'
import { sendOTPVerificationEmail } from '@/lib/otp'
import { prisma } from '@/lib/prisma'
import { badRequest, internal, ok } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  try {
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json(badRequest('INVALID_INPUT', 'errors.invalidInput', 'Email is required'), { status: 400 })
    }

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
    console.error('Error in OTP send endpoint:', error)
    return NextResponse.json(internal('Internal server error', 'errors.internal'), { status: 500 })
  }
}
