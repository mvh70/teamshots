/**
 * Extension Token Management Endpoints
 *
 * POST /api/extensions/tokens - Create a new extension token
 * GET /api/extensions/tokens - List all tokens for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createExtensionToken, listExtensionTokens } from '@/domain/extension'
import { Logger } from '@/lib/logger'
import { z } from 'zod'
import { handleCorsPreflightSync, addCorsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

/**
 * OPTIONS /api/extensions/tokens
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const response = handleCorsPreflightSync(origin)
  return response || new NextResponse(null, { status: 204 })
}

const CreateTokenSchema = z.object({
  name: z.string().max(100).optional(),
  scopes: z.array(z.enum(['outfit:upload', 'generation:create', 'generation:read'])).optional(),
})

/**
 * POST /api/extensions/tokens
 * Create a new extension token
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  try {
    // Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return addCorsHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), origin)
    }

    // Parse and validate body
    let body: z.infer<typeof CreateTokenSchema> = {}
    try {
      const rawBody = await req.json()
      body = CreateTokenSchema.parse(rawBody)
    } catch {
      // Empty body is fine, we have defaults
    }

    // Create token
    const result = await createExtensionToken(session.user.id, body.name, body.scopes)

    if (!result.success) {
      return addCorsHeaders(NextResponse.json({ error: result.error }, { status: 400 }), origin)
    }

    Logger.info('[ExtensionAPI] Token created', {
      userId: session.user.id,
      tokenId: result.tokenId,
    })

    return addCorsHeaders(
      NextResponse.json({
        token: result.token, // Only returned once at creation
        tokenId: result.tokenId,
        expiresAt: result.expiresAt.toISOString(),
      }),
      origin
    )
  } catch (error) {
    Logger.error('[ExtensionAPI] Failed to create token', {
      error: error instanceof Error ? error.message : String(error),
    })
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to create token' }, { status: 500 }),
      origin
    )
  }
}

/**
 * GET /api/extensions/tokens
 * List all tokens for the authenticated user
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')

  try {
    // Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return addCorsHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), origin)
    }

    // List tokens
    const tokens = await listExtensionTokens(session.user.id)

    return addCorsHeaders(
      NextResponse.json({
        tokens: tokens.map((t: typeof tokens[number]) => ({
          id: t.id,
          name: t.name,
          scopes: t.scopes,
          lastUsedAt: t.lastUsedAt?.toISOString() || null,
          lastUsedIp: t.lastUsedIp,
          expiresAt: t.expiresAt.toISOString(),
          createdAt: t.createdAt.toISOString(),
        })),
      }),
      origin
    )
  } catch (error) {
    Logger.error('[ExtensionAPI] Failed to list tokens', {
      error: error instanceof Error ? error.message : String(error),
    })
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to list tokens' }, { status: 500 }),
      origin
    )
  }
}
