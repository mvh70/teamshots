import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

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
    Logger.error('Failed to extend invite expiry', { 
      inviteId, 
      error: error instanceof Error ? error.message : String(error) 
    })
    return false
  }
}

/**
 * Extends invite expiry by token (sliding expiration)
 * Convenience wrapper that finds the invite by token first
 * 
 * @param token - The invite token
 * @returns Promise<boolean> - True if the expiry was extended, false if invite not found
 */
export async function extendInviteExpiryByToken(token: string): Promise<boolean> {
  try {
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      select: { id: true }
    })

    if (!invite) {
      return false
    }

    return await extendInviteExpiry(invite.id)
  } catch (error) {
    Logger.error('Failed to extend invite expiry by token', { 
      token: token.substring(0, 8) + '...', 
      error: error instanceof Error ? error.message : String(error) 
    })
    return false
  }
}

