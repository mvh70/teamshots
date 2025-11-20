import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"
import { randomBytes } from 'crypto'

export function generateOTP(): string {
  const randomNumber = randomBytes(3).readUIntBE(0, 3)
  return (randomNumber % 1000000).toString().padStart(6, '0')
}

export async function createOTP(email: string): Promise<string> {
  const code = generateOTP()
  const expires = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.oTP.deleteMany({
    where: { email }
  })

  await prisma.oTP.create({
    data: {
      email,
      code,
      expires,
    }
  })

  return code
}

type SupportedLocale = 'en' | 'es'

export async function sendOTPVerificationEmail(email: string, locale: SupportedLocale = 'en'): Promise<boolean> {
  try {
    const code = await createOTP(email)
    const { sendOTPEmail } = await import("@/lib/email")
    const result = await sendOTPEmail({ email, code, locale })
    return result.success
  } catch (error) {
    Logger.error('Error sending OTP email', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

export type OTPVerificationResult =
  | { success: true }
  | { success: false, reason: 'invalid_code' | 'expired' | 'already_verified' | 'technical_error' }

export async function verifyOTP(email: string, code: string): Promise<OTPVerificationResult> {
  try {
    const otp = await prisma.oTP.findFirst({
      where: {
        email,
        code,
        expires: {
          gt: new Date()
        },
        verified: false
      }
    })

    if (!otp) {
      // Check if there's an OTP with this code/email combination that was already verified
      const verifiedOtp = await prisma.oTP.findFirst({
        where: {
          email,
          code,
          verified: true
        }
      })

      if (verifiedOtp) {
        return { success: false, reason: 'already_verified' }
      }

      // Check if there's an expired OTP
      const expiredOtp = await prisma.oTP.findFirst({
        where: {
          email,
          code,
          expires: {
            lt: new Date()
          }
        }
      })

      if (expiredOtp) {
        return { success: false, reason: 'expired' }
      }

      // If no OTP found at all, it's an invalid code
      return { success: false, reason: 'invalid_code' }
    }

    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    })

    await prisma.oTP.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    })

    return { success: true }
  } catch (error) {
    Logger.error('Error verifying OTP', { error: error instanceof Error ? error.message : String(error) })
    return { success: false, reason: 'technical_error' }
  }
}

export async function cleanupExpiredOTPs(): Promise<void> {
  await prisma.oTP.deleteMany({
    where: {
      expires: {
        lt: new Date()
      }
    }
  })
}


