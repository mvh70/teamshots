/**
 * Queue Health Check API Endpoint
 * 
 * Returns the health status of all queues and Redis connection
 */

import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    // Lazy import to avoid build-time issues
    const { getQueueHealth } = await import('@/queue')
    const health = await getQueueHealth()
    
    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503
    })
  } catch (error) {
    Logger.error('Queue health check failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}
