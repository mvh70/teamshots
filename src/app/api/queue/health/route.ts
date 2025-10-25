/**
 * Queue Health Check API Endpoint
 * 
 * Returns the health status of all queues and Redis connection
 */

import { NextResponse } from 'next/server'
import { getQueueHealth } from '@/queue'

export async function GET() {
  try {
    const health = await getQueueHealth()
    
    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503
    })
  } catch (error) {
    console.error('Queue health check failed:', error)
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}
