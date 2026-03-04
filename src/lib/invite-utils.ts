import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

function isMissingInviteUpdate(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('no record was found for an update') || message.includes('record to update not found')
}

/**
 * Extends invite expiry by 24 hours from now (sliding expiration)
 * This ensures invites stay active as long as the user is actively using the dashboard
 * 
 * @param inviteId - The ID of the invite to extend
 * @returns Promise<boolean> - True if the expiry was extended, false if invite not found
 */
export async function extendInviteExpiry(inviteId: string): Promise<boolean> {
  try {
    const now = new Date()
    const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

    await prisma.teamInvite.update({
      where: { id: inviteId },
      data: { expiresAt: newExpiresAt }
    })

    Logger.debug('Extended invite expiry', { 
      inviteId, 
      newExpiresAt: newExpiresAt.toISOString() 
    })

    return true
  } catch (error) {
    if (isMissingInviteUpdate(error)) {
      Logger.warn('Skipped invite expiry extension because invite no longer exists', { inviteId })
    } else {
      Logger.error('Failed to extend invite expiry', {
        inviteId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    return false
  }
}
