import { prisma } from "@/lib/prisma"
import { randomBytes } from 'crypto'

// Generate a 6-digit OTP using cryptographically secure random
export function generateOTP(): string {
  // Generate 3 random bytes and convert to a number between 0-16777215
  const randomNumber = randomBytes(3).readUIntBE(0, 3)
  // Take modulo 1000000 to get 6 digits, pad with zeros
  return (randomNumber % 1000000).toString().padStart(6, '0')
}

// Store OTP in database
export async function createOTP(email: string): Promise<string> {
  const code = generateOTP()
  const expires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Delete any existing OTP for this email
  await prisma.oTP.deleteMany({
    where: { email }
  })

  // Create new OTP
  await prisma.oTP.create({
    data: {
      email,
      code,
      expires,
    }
  })

  return code
}

// Send OTP via email
type SupportedLocale = 'en' | 'es'

export async function sendOTPVerificationEmail(email: string, locale: SupportedLocale = 'en'): Promise<boolean> {
  try {
    const code = await createOTP(email)
    
    const { sendOTPEmail } = await import("@/lib/email")
    const result = await sendOTPEmail({ email, code, locale })
    
    return result.success
  } catch (error) {
    console.error('Error sending OTP email:', error)
    return false
  }
}

// Verify OTP
export async function verifyOTP(email: string, code: string): Promise<boolean> {
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
      return false
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    })

    // Clean up expired OTPs
    await prisma.oTP.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    })

    return true
  } catch (error) {
    console.error('Error verifying OTP:', error)
    return false
  }
}

// Clean up expired OTPs (can be called periodically)
export async function cleanupExpiredOTPs(): Promise<void> {
  await prisma.oTP.deleteMany({
    where: {
      expires: {
        lt: new Date()
      }
    }
  })
}
