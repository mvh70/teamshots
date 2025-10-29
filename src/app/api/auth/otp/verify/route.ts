import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/domain/auth/otp'
import { badRequest, ok, internal } from '@/lib/api-response'
import { Logger } from '@/lib/logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(badRequest('INVALID_INPUT', 'errors.invalidInput', 'Email and code are required'), { status: 400 })
    }

    const isValid = await verifyOTP(email, code)

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
