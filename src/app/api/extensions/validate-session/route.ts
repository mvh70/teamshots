/**
 * Extension Session Validation Endpoint
 *
 * POST /api/extensions/validate-session
 *
 * Validates if the user has an active web session and returns (or creates) an extension token.
 * This is the primary auth flow for the Chrome extension:
 *
 * 1. Extension calls this endpoint with credentials: 'include' (sending cookies)
 * 2. If user is logged in, we return an existing active token or create a new one
 * 3. If not logged in, we return 401 - extension should show "Please Log In" UI
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createExtensionToken, EXTENSION_SCOPES } from '@/domain/extension'
import { Logger } from '@/lib/logger'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/extensions/validate-session
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

// Default scopes for extension tokens created via session validation
const DEFAULT_SCOPES = [
  EXTENSION_SCOPES.OUTFIT_UPLOAD,
  EXTENSION_SCOPES.GENERATION_CREATE,
  EXTENSION_SCOPES.GENERATION_READ,
]

/**
 * POST /api/extensions/validate-session
 *
 * Returns existing active token or creates new one if user has valid session
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  try {
    // Check session (via cookies)
    const session = await auth()

    if (!session?.user?.id) {
      return addCorsHeaders(
        NextResponse.json(
          {
            authenticated: false,
            error: 'Not authenticated. Please log in on the website first.',
          },
          { status: 401 }
        ),
        origin
      )
    }

    // Get user info for the extension (including plan for package selection)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        planTier: true,
        planPeriod: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!user) {
      return addCorsHeaders(
        NextResponse.json(
          {
            authenticated: false,
            error: 'User not found',
          },
          { status: 401 }
        ),
        origin
      )
    }

    // Check for existing active extension token
    const existingToken = await prisma.extensionToken.findFirst({
      where: {
        userId: session.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // If existing token found, we can't return it (we don't store plain tokens)
    // But we can tell the extension it exists and ask if they want a new one
    // For simplicity, we'll create a new token each time (old ones remain valid)

    // Get device info from request for token naming
    const userAgent = req.headers.get('user-agent') || 'Unknown'
    const deviceName = parseDeviceName(userAgent)
    const tokenName = `Chrome Extension - ${deviceName}`

    // Create new token
    const result = await createExtensionToken(session.user.id, tokenName, DEFAULT_SCOPES)

    if (!result.success) {
      Logger.error('[ExtensionAPI] Failed to create token during session validation', {
        userId: session.user.id,
        error: result.error,
      })
      return addCorsHeaders(
        NextResponse.json(
          {
            authenticated: true,
            error: 'Failed to create extension token',
          },
          { status: 500 }
        ),
        origin
      )
    }

    Logger.info('[ExtensionAPI] Session validated, token created', {
      userId: session.user.id,
      tokenId: result.tokenId,
      existingTokens: existingToken ? 1 : 0,
    })

    return addCorsHeaders(
      NextResponse.json({
        authenticated: true,
        token: result.token,
        tokenId: result.tokenId,
        expiresAt: result.expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.person?.firstName || null,
          lastName: user.person?.lastName || null,
          personId: user.person?.id || null,
        },
      }),
      origin
    )
  } catch (error) {
    Logger.error('[ExtensionAPI] Session validation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return addCorsHeaders(
      NextResponse.json(
        {
          authenticated: false,
          error: 'Session validation failed',
        },
        { status: 500 }
      ),
      null // Origin not available in catch block
    )
  }
}

/**
 * Parse device name from user agent for token naming
 */
function parseDeviceName(userAgent: string): string {
  // Simple parsing - could be enhanced with a library
  if (userAgent.includes('Mac OS X')) {
    return 'Mac'
  }
  if (userAgent.includes('Windows')) {
    return 'Windows'
  }
  if (userAgent.includes('Linux')) {
    return 'Linux'
  }
  if (userAgent.includes('CrOS')) {
    return 'ChromeOS'
  }
  return 'Unknown Device'
}
