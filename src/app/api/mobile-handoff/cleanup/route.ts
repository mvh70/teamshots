import { NextResponse } from 'next/server'
import { cleanupExpiredHandoffTokens } from '@/lib/mobile-handoff'
import { Logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * POST /api/mobile-handoff/cleanup
 * Manually trigger cleanup of expired mobile handoff tokens
 * Useful for testing and manual cleanup
 */
export async function POST() {
  try {
    const now = new Date()
    
    // Count expired tokens before cleanup
    const expiredBefore = await prisma.mobileHandoffToken.count({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { absoluteExpiry: { lt: now } }
        ]
      }
    })
    
    // Run cleanup
    const deletedCount = await cleanupExpiredHandoffTokens()
    
    // Count remaining tokens after cleanup
    const expiredAfter = await prisma.mobileHandoffToken.count({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { absoluteExpiry: { lt: now } }
        ]
      }
    })
    
    Logger.info('Manual cleanup of expired mobile handoff tokens completed', {
      deleted: deletedCount,
      foundBefore: expiredBefore,
      remainingAfter: expiredAfter
    })
    
    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      foundBefore: expiredBefore,
      remainingAfter: expiredAfter
    })
  } catch (error) {
    Logger.error('Error during manual cleanup', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/mobile-handoff/cleanup
 * Check status of expired tokens without cleaning them
 */
export async function GET() {
  try {
    const now = new Date()
    
    const expiredCount = await prisma.mobileHandoffToken.count({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { absoluteExpiry: { lt: now } }
        ]
      }
    })
    
    const totalCount = await prisma.mobileHandoffToken.count()
    
    return NextResponse.json({
      expired: expiredCount,
      total: totalCount,
      needsCleanup: expiredCount > 0
    })
  } catch (error) {
    Logger.error('Error checking expired tokens', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

