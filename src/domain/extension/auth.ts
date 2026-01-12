/**
 * Extension Authentication Library
 *
 * Handles authentication tokens for Chrome extension.
 * Tokens are stored hashed (SHA-256) and never stored in plaintext.
 */

import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import { Logger } from '@/lib/logger'

// Token expiration: 90 days
const TOKEN_EXPIRATION_DAYS = 90

// Available scopes for extension tokens
export const EXTENSION_SCOPES = {
  OUTFIT_UPLOAD: 'outfit:upload',
  GENERATION_CREATE: 'generation:create',
  GENERATION_READ: 'generation:read',
} as const

export type ExtensionScope = (typeof EXTENSION_SCOPES)[keyof typeof EXTENSION_SCOPES]

export interface ExtensionTokenPayload {
  userId: string
  scopes: ExtensionScope[]
  tokenId: string
}

export interface CreateTokenResult {
  success: true
  token: string // Plain token (only returned once, at creation)
  tokenId: string
  expiresAt: Date
}

export interface CreateTokenError {
  success: false
  error: string
}

export interface ValidateTokenResult {
  success: true
  payload: ExtensionTokenPayload
}

export interface ValidateTokenError {
  success: false
  error: string
}

/**
 * Hash a token using SHA-256
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate a secure random token
 * Format: ext_<random_bytes>
 */
function generateToken(): string {
  const randomPart = randomBytes(32).toString('base64url')
  return `ext_${randomPart}`
}

/**
 * Create a new extension token for a user
 *
 * @param userId - The user ID to create the token for
 * @param name - Optional user-friendly name for the token
 * @param scopes - Optional array of scopes (defaults to outfit:upload, generation:create)
 * @returns The plain token (only returned once) or an error
 */
export async function createExtensionToken(
  userId: string,
  name?: string,
  scopes?: ExtensionScope[]
): Promise<CreateTokenResult | CreateTokenError> {
  try {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Generate token
    const plainToken = generateToken()
    const hashedToken = hashToken(plainToken)

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRATION_DAYS)

    // Create token in database
    const extensionToken = await prisma.extensionToken.create({
      data: {
        userId,
        token: hashedToken,
        name: name || null,
        scopes: scopes || [EXTENSION_SCOPES.OUTFIT_UPLOAD, EXTENSION_SCOPES.GENERATION_CREATE],
        expiresAt,
      },
    })

    Logger.info('[ExtensionAuth] Token created', {
      tokenId: extensionToken.id,
      userId,
      scopes: extensionToken.scopes,
      expiresAt,
    })

    return {
      success: true,
      token: plainToken, // Only time the plain token is returned
      tokenId: extensionToken.id,
      expiresAt,
    }
  } catch (error) {
    Logger.error('[ExtensionAuth] Failed to create token', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'Failed to create token' }
  }
}

/**
 * Validate an extension token from the X-Extension-Token header
 *
 * @param token - The plain token from the header
 * @param requiredScope - Optional scope to check for
 * @param ipAddress - Optional IP address for tracking
 * @returns The token payload or an error
 */
export async function validateExtensionToken(
  token: string,
  requiredScope?: ExtensionScope,
  ipAddress?: string
): Promise<ValidateTokenResult | ValidateTokenError> {
  try {
    if (!token) {
      return { success: false, error: 'Token is required' }
    }

    // Validate token format
    if (!token.startsWith('ext_')) {
      return { success: false, error: 'Invalid token format' }
    }

    const hashedToken = hashToken(token)

    // Find token in database
    const extensionToken = await prisma.extensionToken.findUnique({
      where: { token: hashedToken },
      select: {
        id: true,
        userId: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    })

    if (!extensionToken) {
      return { success: false, error: 'Invalid token' }
    }

    // Check if revoked
    if (extensionToken.revokedAt) {
      return { success: false, error: 'Token has been revoked' }
    }

    // Check if expired
    if (extensionToken.expiresAt < new Date()) {
      return { success: false, error: 'Token has expired' }
    }

    // Check required scope
    if (requiredScope && !extensionToken.scopes.includes(requiredScope)) {
      return { success: false, error: `Token does not have required scope: ${requiredScope}` }
    }

    // Update last used timestamp (don't await to avoid blocking)
    prisma.extensionToken
      .update({
        where: { id: extensionToken.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: ipAddress || null,
        },
      })
      .catch((err: unknown) => {
        Logger.error('[ExtensionAuth] Failed to update lastUsedAt', {
          tokenId: extensionToken.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })

    return {
      success: true,
      payload: {
        userId: extensionToken.userId,
        scopes: extensionToken.scopes as ExtensionScope[],
        tokenId: extensionToken.id,
      },
    }
  } catch (error) {
    Logger.error('[ExtensionAuth] Token validation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'Token validation failed' }
  }
}

/**
 * Revoke an extension token
 *
 * @param tokenId - The token ID to revoke
 * @param userId - The user ID (for authorization)
 * @returns Success or error
 */
export async function revokeExtensionToken(
  tokenId: string,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Find and verify ownership
    const extensionToken = await prisma.extensionToken.findUnique({
      where: { id: tokenId },
      select: { id: true, userId: true, revokedAt: true },
    })

    if (!extensionToken) {
      return { success: false, error: 'Token not found' }
    }

    if (extensionToken.userId !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    if (extensionToken.revokedAt) {
      return { success: false, error: 'Token already revoked' }
    }

    // Revoke the token
    await prisma.extensionToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    })

    Logger.info('[ExtensionAuth] Token revoked', {
      tokenId,
      userId,
    })

    return { success: true }
  } catch (error) {
    Logger.error('[ExtensionAuth] Failed to revoke token', {
      tokenId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'Failed to revoke token' }
  }
}

/**
 * List all extension tokens for a user
 *
 * @param userId - The user ID
 * @returns Array of tokens (without the actual token values)
 */
export async function listExtensionTokens(userId: string) {
  const tokens = await prisma.extensionToken.findMany({
    where: {
      userId,
      revokedAt: null, // Only active tokens
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      lastUsedAt: true,
      lastUsedIp: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return tokens
}

/**
 * Get extension auth from request headers
 *
 * @param headers - Request headers
 * @param requiredScope - Optional scope to check for
 * @returns The token payload or null
 */
export async function getExtensionAuthFromHeaders(
  headers: Headers,
  requiredScope?: ExtensionScope
): Promise<ExtensionTokenPayload | null> {
  const token = headers.get('X-Extension-Token')
  if (!token) {
    return null
  }

  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || undefined

  const result = await validateExtensionToken(token, requiredScope, ipAddress)
  if (!result.success) {
    return null
  }

  return result.payload
}
