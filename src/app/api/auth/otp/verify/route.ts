import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/domain/auth/otp'
import { badRequest, ok, internal } from '@/lib/api-response'
import { Logger } from '@/lib/logger'
import { z } from 'zod'

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
