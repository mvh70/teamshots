import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"
import { randomBytes } from 'crypto'

const TOKEN_EXPIRY_HOURS = 1 // Password reset tokens expire faster for security

/**
 * Generates a cryptographically secure token for password reset
 */
function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Creates a password reset token for a user.
 * Stores in VerificationToken table with identifier format: "password-reset:{email}"
 * 
 * @param email - User's email address
 * @returns The generated token
 */
export async function generatePasswordResetToken(email: string): Promise<string> {
  const token = generateSecureToken()
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  const identifier = `password-reset:${email.toLowerCase()}`

  // Delete any existing password reset tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier }
  })

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires,
    }
  })

  Logger.info('Password reset token created', { email, expiresAt: expires.toISOString() })
  return token
}

export type TokenVerificationResult =
  | { success: true; email: string }
  | { success: false; reason: 'invalid_token' | 'expired' | 'already_used' | 'technical_error' }

/**
 * Verifies a password reset token without consuming it.
 * 
 * @param token - The token to verify
 * @returns The email if valid, or an error reason
 */
export async function verifyPasswordResetToken(token: string): Promise<TokenVerificationResult> {
  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    })

    if (!verificationToken) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if it's a password-reset token
    if (!verificationToken.identifier.startsWith('password-reset:')) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if expired
    if (new Date() > verificationToken.expires) {
      return { success: false, reason: 'expired' }
    }

    // Extract email from identifier
    const email = verificationToken.identifier.replace('password-reset:', '')

    return { success: true, email }
  } catch (error) {
    Logger.error('Error verifying password reset token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return { success: false, reason: 'technical_error' }
  }
}

/**
 * Consumes a password reset token (deletes it so it can't be reused)
 * 
 * @param token - The token to consume
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
  try {
    await prisma.verificationToken.delete({
      where: { token }
    })
    Logger.info('Password reset token consumed', { token: token.substring(0, 10) + '...' })
  } catch (error) {
    Logger.error('Error consuming password reset token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
  }
}

