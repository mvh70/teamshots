import { NextRequest, NextResponse } from 'next/server'
import { sendOTPVerificationEmail } from '@/lib/otp'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, locale } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Simple server-side throttle: one code per 30 seconds per email
    const last = await prisma.oTP.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' as const },
    })
    if (last && Date.now() - new Date(last.createdAt as unknown as string).getTime() < 30 * 1000) {
      const wait = Math.ceil((30 * 1000 - (Date.now() - new Date(last.createdAt as unknown as string).getTime())) / 1000)
      return NextResponse.json({ success: true, throttled: true, wait }, { status: 200 })
    }

    const success = await sendOTPVerificationEmail(email, locale || 'en')

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to send OTP email' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in OTP send endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
