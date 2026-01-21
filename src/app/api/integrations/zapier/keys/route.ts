import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTeamPermission } from '@/domain/access/permissions'
import { createApiKeyForTeam, listApiKeysForTeam } from '@/domain/integrations/zapier'
import { Logger } from '@/lib/logger'

const createKeySchema = z.object({
  name: z.string().min(1).max(100).optional().default('Default')
})

/**
 * GET /api/integrations/zapier/keys
 * List all API keys for the user's team (returns masked info only)
 */
export async function GET(request: NextRequest) {
  try {
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage_integrations'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { teamId } = permissionCheck

    const keys = await listApiKeysForTeam(teamId)

    return NextResponse.json({
      success: true,
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        created_at: key.createdAt.toISOString(),
        last_used_at: key.lastUsedAt?.toISOString() || null,
        is_revoked: key.isRevoked,
        masked_prefix: key.maskedPrefix
      }))
    })
  } catch (error) {
    Logger.error('Error listing Zapier API keys', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { success: false, error: 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/zapier/keys
 * Create a new API key for the user's team
 * Returns the plain key ONCE - it cannot be retrieved again
 */
export async function POST(request: NextRequest) {
  try {
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage_integrations'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { teamId, session } = permissionCheck

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const parseResult = createKeySchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const { name } = parseResult.data

    // Create the new API key
    const result = await createApiKeyForTeam(teamId, name)

    Logger.info('Zapier API key created', {
      teamId,
      keyId: result.id,
      keyName: result.name,
      userId: session.user.id
    })

    return NextResponse.json({
      success: true,
      key: {
        id: result.id,
        name: result.name,
        created_at: result.createdAt.toISOString(),
        // IMPORTANT: This is the only time the plain key is returned
        api_key: result.plainKey
      },
      warning: 'Store this API key securely. It cannot be retrieved again.'
    })
  } catch (error) {
    Logger.error('Error creating Zapier API key', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}
