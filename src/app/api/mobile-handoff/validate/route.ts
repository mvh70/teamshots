import { NextRequest, NextResponse } from 'next/server'
import { validateMobileHandoffToken, cleanupExpiredHandoffTokens } from '@/lib/mobile-handoff'
import { Logger } from '@/lib/logger'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/mobile-handoff/validate?token=xxx
 * Validate a mobile handoff token and return user context
 * Public endpoint (token is the auth)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Clean up expired tokens in the background (non-blocking)
    // This runs on every check-in to automatically clean up expired tokens
    void cleanupExpiredHandoffTokens()
      .then(count => {
        if (count > 0) {
          Logger.info('Cleaned up expired mobile handoff tokens', { count })
        }
      })
      .catch(error => {
        // Log but don't fail the request if cleanup fails
        Logger.warn('Background token cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })

    // Generate a device ID from user agent and IP for device binding
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || ''
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined
    const deviceId = generateDeviceId(userAgent, ip)

    const result = await validateMobileHandoffToken(token, deviceId)

    if (!result.success) {
      const statusCode = result.code === 'NOT_FOUND' ? 404 
        : result.code === 'EXPIRED' ? 410 
        : result.code === 'DEVICE_MISMATCH' ? 403 
        : 400

      return NextResponse.json({ 
        error: result.error,
        code: result.code 
      }, { status: statusCode })
    }

    // Get selfie count for the user
    let selfieCount = 0
    if (result.context.personId) {
      selfieCount = await prisma.selfie.count({
        where: { personId: result.context.personId }
      })
    }

    Logger.info('Mobile handoff token validated', {
      userId: result.context.userId,
      personId: result.context.personId,
      deviceConnected: !!result.context.deviceId
    })

    return NextResponse.json({
      valid: true,
      context: {
        personId: result.context.personId,
        firstName: result.context.firstName,
        selfieCount
      }
    })
  } catch (error) {
    Logger.error('Error validating mobile handoff token', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * SECURITY: Generate cryptographically secure device ID using HMAC
 * Prevents device ID collisions and makes it harder to spoof devices
 *
 * Uses HMAC with secret + (user-agent + IP) to ensure:
 * 1. Same device gets same ID consistently
 * 2. Different users with same browser get different IDs
 * 3. Cannot easily reverse engineer or predict device IDs
 */
function generateDeviceId(userAgent: string, ip?: string): string {
  const { createHmac } = require('crypto')

  // Use environment variable or fallback secret (should be set in production)
  const secret = process.env.DEVICE_ID_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-device-secret'

  // Include IP address if available for better uniqueness
  const deviceFingerprint = ip ? `${userAgent}:${ip}` : userAgent

  // Create HMAC-SHA256 hash
  const hmac = createHmac('sha256', secret)
  hmac.update(deviceFingerprint)

  return hmac.digest('hex')
}

