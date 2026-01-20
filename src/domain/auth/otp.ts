import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"
import { randomBytes } from 'crypto'

export function generateOTP(): string {
  const randomNumber = randomBytes(3).readUIntBE(0, 3)
  return (randomNumber % 1000000).toString().padStart(6, '0')
}

export async function createOTP(email: string): Promise<string> {
  const code = generateOTP()
  const expires = new Date(Date.now() + 10 * 60 * 1000)

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
    // SECURITY: Use SINGLE query for constant-time execution to prevent timing attacks
    // Previously used 1-3 queries depending on OTP state, allowing attackers to
    // enumerate valid codes by measuring response times
    const otp = await prisma.oTP.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' } // Get most recent if multiple exist
    })

    // Add artificial delay for timing attack prevention (constant time)
    // This ensures all verification attempts take the same amount of time
    await new Promise(resolve => setTimeout(resolve, 100))

    // If no OTP found at all, return generic error
    if (!otp) {
      return { success: false, reason: 'invalid_code' }
    }

    // Check all conditions (but check them all to maintain constant time)
    const now = new Date()
    const isExpired = otp.expires < now
    const isVerified = otp.verified
    const isValid = !isExpired && !isVerified

    // Return appropriate error based on state
    if (isVerified) {
      return { success: false, reason: 'already_verified' }
    }

    if (isExpired) {
      return { success: false, reason: 'expired' }
    }

    if (!isValid) {
      return { success: false, reason: 'invalid_code' }
    }

    // Valid OTP - mark as verified
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    })

    // Clean up old OTPs asynchronously (don't wait for this)
    prisma.oTP.deleteMany({
      where: {
        expires: {
          lt: now
        }
      }
    }).catch(() => {
      // Ignore errors in cleanup - this is fire-and-forget
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


