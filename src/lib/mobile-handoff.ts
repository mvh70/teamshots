import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Logger } from '@/lib/logger'

// Configuration
const SLIDING_EXPIRY_MINUTES = 15
const ABSOLUTE_EXPIRY_HOURS = 1
const MAX_TOKENS_PER_USER = 3

// SECURITY: Dev bypass moved to environment variable to prevent hardcoded backdoor
// This must ONLY be set in .env.development (never in .env.production)
// If set in production, startup validation will throw an error
const DEV_BYPASS_USER_ID = process.env.DEV_BYPASS_USER_ID

export interface MobileHandoffContext {
  userId: string
  personId: string
  firstName: string
  deviceId: string | null
}

export type CreateHandoffTokenResult = {
  success: true
  token: string
  expiresAt: Date
} | {
  success: false
  error: string
}

export type ValidateHandoffTokenResult = {
  success: true
  context: MobileHandoffContext
  tokenId: string
} | {
  success: false
  error: string
  code: 'INVALID' | 'EXPIRED' | 'DEVICE_MISMATCH' | 'NOT_FOUND'
}

/**
 * Generate a new mobile handoff token for QR code selfie upload flow
 */
export async function createMobileHandoffToken(
  userId: string,
  personId: string,
  userAgent: string | null
): Promise<CreateHandoffTokenResult> {
  try {
    // SECURITY: Dev bypass with strict validation
    // - ONLY works in development mode (not production)
    // - Requires explicit environment variable set
    // - Startup validation prevents production misconfiguration
    const isDevBypass =
      process.env.NODE_ENV === 'development' &&
      DEV_BYPASS_USER_ID !== undefined &&
      DEV_BYPASS_USER_ID.trim() !== '' &&
      userId === DEV_BYPASS_USER_ID
    
    // Check existing token count for user (skip cleanup in dev bypass mode)
    if (!isDevBypass) {
      const existingCount = await prisma.mobileHandoffToken.count({
        where: {
          userId,
          expiresAt: { gt: new Date() }
        }
      })

      if (existingCount >= MAX_TOKENS_PER_USER) {
        // Clean up oldest tokens to make room
        const oldestTokens = await prisma.mobileHandoffToken.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          take: existingCount - MAX_TOKENS_PER_USER + 1,
          select: { id: true }
        })
        
        await prisma.mobileHandoffToken.deleteMany({
          where: { id: { in: oldestTokens.map(t => t.id) } }
        })
      }
    }

    const token = randomBytes(32).toString('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SLIDING_EXPIRY_MINUTES * 60 * 1000)
    const absoluteExpiry = new Date(now.getTime() + ABSOLUTE_EXPIRY_HOURS * 60 * 60 * 1000)

    await prisma.mobileHandoffToken.create({
      data: {
        token,
        userId,
        personId,
        expiresAt,
        absoluteExpiry,
        userAgent
      }
    })

    Logger.info('Created mobile handoff token', {
      userId,
      personId,
      expiresAt: expiresAt.toISOString()
    })

    return {
      success: true,
      token,
      expiresAt
    }
  } catch (error) {
    Logger.error('Failed to create mobile handoff token', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: 'Failed to create handoff token'
    }
  }
}

/**
 * Validate a mobile handoff token and extend its expiry (sliding expiration)
 * Optionally bind to a device ID on first use
 */
export async function validateMobileHandoffToken(
  token: string,
  deviceId?: string
): Promise<ValidateHandoffTokenResult> {
  try {
    const handoffToken = await prisma.mobileHandoffToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            person: {
              select: {
                id: true,
                firstName: true
              }
            }
          }
        }
      }
    })

    if (!handoffToken) {
      return { success: false, error: 'Token not found', code: 'NOT_FOUND' }
    }

    const now = new Date()

    // SECURITY: Dev bypass with strict validation
    const isDevBypass =
      process.env.NODE_ENV === 'development' &&
      DEV_BYPASS_USER_ID !== undefined &&
      DEV_BYPASS_USER_ID.trim() !== '' &&
      handoffToken.userId === DEV_BYPASS_USER_ID

    // Check absolute expiry (skip in dev bypass mode)
    if (!isDevBypass && handoffToken.absoluteExpiry < now) {
      await prisma.mobileHandoffToken.delete({ where: { id: handoffToken.id } })
      return { success: false, error: 'Token has expired', code: 'EXPIRED' }
    }

    // Check sliding expiry (skip in dev bypass mode)
    if (!isDevBypass && handoffToken.expiresAt < now) {
      await prisma.mobileHandoffToken.delete({ where: { id: handoffToken.id } })
      return { success: false, error: 'Token has expired', code: 'EXPIRED' }
    }

    // Check device binding (skip in dev bypass mode)
    if (!isDevBypass && handoffToken.deviceId && deviceId && handoffToken.deviceId !== deviceId) {
      Logger.warn('Mobile handoff token device mismatch', {
        tokenId: handoffToken.id,
        expectedDevice: handoffToken.deviceId.substring(0, 8) + '...',
        attemptedDevice: deviceId.substring(0, 8) + '...'
      })
      return { success: false, error: 'Token is bound to another device', code: 'DEVICE_MISMATCH' }
    }

    // Extend sliding expiry and optionally bind device
    const newExpiresAt = new Date(Math.min(
      now.getTime() + SLIDING_EXPIRY_MINUTES * 60 * 1000,
      handoffToken.absoluteExpiry.getTime()
    ))

    await prisma.mobileHandoffToken.update({
      where: { id: handoffToken.id },
      data: {
        expiresAt: newExpiresAt,
        lastUsedAt: now,
        // Bind to device on first use if not already bound
        ...(deviceId && !handoffToken.deviceId ? { deviceId } : {})
      }
    })

    const firstName = handoffToken.user.person?.firstName || 'User'

    return {
      success: true,
      context: {
        userId: handoffToken.userId,
        personId: handoffToken.personId,
        firstName,
        deviceId: handoffToken.deviceId || deviceId || null
      },
      tokenId: handoffToken.id
    }
  } catch (error) {
    Logger.error('Failed to validate mobile handoff token', {
      token: token.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error)
    })
    return { success: false, error: 'Validation failed', code: 'INVALID' }
  }
}

/**
 * Invalidate a specific handoff token
 */
export async function invalidateMobileHandoffToken(token: string): Promise<boolean> {
  try {
    await prisma.mobileHandoffToken.delete({
      where: { token }
    })
    return true
  } catch {
    return false
  }
}

/**
 * Invalidate all handoff tokens for a user (e.g., on logout or password change)
 */
export async function invalidateAllUserHandoffTokens(userId: string): Promise<number> {
  try {
    const result = await prisma.mobileHandoffToken.deleteMany({
      where: { userId }
    })
    
    if (result.count > 0) {
      Logger.info('Invalidated user handoff tokens', { userId, count: result.count })
    }
    
    return result.count
  } catch (error) {
    Logger.error('Failed to invalidate user handoff tokens', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    })
    return 0
  }
}

/**
 * Clean up expired tokens (for cron job or automatic cleanup)
 */
export async function cleanupExpiredHandoffTokens(): Promise<number> {
  try {
    const now = new Date()

    // Delete expired tokens
    const result = await prisma.mobileHandoffToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { absoluteExpiry: { lt: now } }
        ]
      }
    })

    if (result.count > 0) {
      Logger.info('Cleaned up expired mobile handoff tokens', { count: result.count })
    }

    return result.count
  } catch (error) {
    Logger.error('Failed to cleanup expired handoff tokens', {
      error: error instanceof Error ? error.message : String(error)
    })
    return 0
  }
}

/**
 * Get the status of a handoff token (for desktop polling)
 */
export async function getHandoffTokenStatus(token: string): Promise<{
  valid: boolean
  lastUsedAt: Date | null
  deviceConnected: boolean
} | null> {
  try {
    const handoffToken = await prisma.mobileHandoffToken.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        absoluteExpiry: true,
        lastUsedAt: true,
        deviceId: true,
        createdAt: true
      }
    })

    if (!handoffToken) {
      return null
    }

    const now = new Date()
    const valid = handoffToken.expiresAt > now && handoffToken.absoluteExpiry > now
    const deviceConnected = !!handoffToken.deviceId

    return {
      valid,
      lastUsedAt: handoffToken.lastUsedAt,
      deviceConnected
    }
  } catch {
    return null
  }
}

/**
 * Generate a URL for the mobile handoff QR code
 */
export function getMobileHandoffUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/upload-selfie/${token}`
}

