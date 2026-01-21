import { NextRequest, NextResponse } from 'next/server'
import { withTeamPermission } from '@/domain/access/permissions'
import { revokeApiKey } from '@/domain/integrations/zapier'
import { Logger } from '@/lib/logger'

/**
 * DELETE /api/integrations/zapier/keys/[id]
 * Revoke (soft delete) an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionCheck = await withTeamPermission(
      request,
      'team.manage_integrations'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { teamId, session } = permissionCheck
    const { id: keyId } = await params

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 }
      )
    }

    const success = await revokeApiKey(keyId, teamId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'API key not found or already revoked' },
        { status: 404 }
      )
    }

    Logger.info('Zapier API key revoked', {
      teamId,
      keyId,
      userId: session.user.id
    })

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully'
    })
  } catch (error) {
    Logger.error('Error revoking Zapier API key', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { success: false, error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}
