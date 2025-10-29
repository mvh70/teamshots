import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logger';

/**
 * Health check endpoint for monitoring and deployment verification
 * Used by Coolify to verify the application is running correctly
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log internally but don't expose details
    Logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) })
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

