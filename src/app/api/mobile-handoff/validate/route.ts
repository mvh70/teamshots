import { NextRequest, NextResponse } from 'next/server'
import { validateMobileHandoffToken, cleanupExpiredHandoffTokens } from '@/lib/mobile-handoff'
import { Logger } from '@/lib/logger'
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

    // REMOVED device binding on validation
    // Device binding was causing issues because:
    // 1. QR scanner apps use a webview with different user-agent than actual browser
    // 2. When user opens link in real browser, user-agent differs → DEVICE_MISMATCH
    //
    // The handoff token itself is the security - it's a 64-char cryptographic secret.
    // Device binding adds friction without meaningful security benefit for this flow.
    const result = await validateMobileHandoffToken(token)

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

