import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"
import { randomBytes } from 'crypto'

const TOKEN_EXPIRY_HOURS = 24

/**
 * Generates a cryptographically secure token for password setup
 */
function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Creates a password setup token for a user.
 * Stores in VerificationToken table with identifier format: "password-setup:{email}"
 * 
 * @param email - User's email address
 * @returns The generated token
 */
export async function generatePasswordSetupToken(email: string): Promise<string> {
  const token = generateSecureToken()
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  const identifier = `password-setup:${email.toLowerCase()}`

  // Delete any existing password setup tokens for this email
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

  Logger.info('Password setup token created', { email, expiresAt: expires.toISOString() })
  return token
}

export type TokenVerificationResult =
  | { success: true; email: string }
  | { success: false; reason: 'invalid_token' | 'expired' | 'already_used' | 'technical_error' }

/**
 * Verifies a password setup token without consuming it.
 * 
 * @param token - The token to verify
 * @returns The email if valid, or an error reason
 */
export async function verifyPasswordSetupToken(token: string): Promise<TokenVerificationResult> {
  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    })

    if (!verificationToken) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if it's a password-setup token
    if (!verificationToken.identifier.startsWith('password-setup:')) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if expired
    if (new Date() > verificationToken.expires) {
      return { success: false, reason: 'expired' }
    }

    // Extract email from identifier
    const email = verificationToken.identifier.replace('password-setup:', '')

    return { success: true, email }
  } catch (error) {
    Logger.error('Error verifying password setup token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return { success: false, reason: 'technical_error' }
  }
}

/**
 * Consumes (deletes) a password setup token after successful password set.
 * 
 * @param token - The token to consume
 * @returns true if successfully consumed, false otherwise
 */
export async function consumePasswordSetupToken(token: string): Promise<boolean> {
  try {
    const deleted = await prisma.verificationToken.delete({
      where: { token }
    })
    
    Logger.info('Password setup token consumed', { 
      identifier: deleted.identifier 
    })
    
    return true
  } catch (error) {
    Logger.error('Error consuming password setup token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return false
  }
}

/**
 * Cleans up expired verification tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.verificationToken.deleteMany({
    where: {
      expires: {
        lt: new Date()
      }
    }
  })
  
  if (result.count > 0) {
    Logger.info('Cleaned up expired verification tokens', { count: result.count })
  }
  
  return result.count
}

// Sign-in token for guest checkout (short-lived, single-use)
const SIGNIN_TOKEN_EXPIRY_MINUTES = 5

/**
 * Creates a short-lived sign-in token for guest checkout.
 * Used to sign in users who don't have a password yet (after OTP verification).
 * 
 * @param email - User's email address
 * @returns The generated token
 */
export async function generateSignInToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SIGNIN_TOKEN_EXPIRY_MINUTES * 60 * 1000)
  const identifier = `signin-token:${email.toLowerCase()}`

  // Delete any existing sign-in tokens for this email
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

  Logger.info('Sign-in token created for guest checkout', { email, expiresAt: expires.toISOString() })
  return token
}

export type SignInTokenResult =
  | { success: true; email: string }
  | { success: false; reason: 'invalid_token' | 'expired' | 'technical_error' }

/**
 * Verifies and consumes a sign-in token (single-use).
 * 
 * @param token - The token to verify
 * @returns The email if valid, or an error reason
 */
export async function verifyAndConsumeSignInToken(token: string): Promise<SignInTokenResult> {
  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    })

    if (!verificationToken) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if it's a signin-token
    if (!verificationToken.identifier.startsWith('signin-token:')) {
      return { success: false, reason: 'invalid_token' }
    }

    // Check if expired
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
      return { success: false, reason: 'expired' }
    }

    // Extract email from identifier
    const email = verificationToken.identifier.replace('signin-token:', '')

    // Consume (delete) the token - it's single-use
    await prisma.verificationToken.delete({ where: { token } })

    Logger.info('Sign-in token verified and consumed', { email })
    return { success: true, email }
  } catch (error) {
    Logger.error('Error verifying sign-in token', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return { success: false, reason: 'technical_error' }
  }
}

