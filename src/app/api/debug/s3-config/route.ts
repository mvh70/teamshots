import { NextResponse } from 'next/server'
import { debugS3Config } from '@/lib/debug-s3-config'
import { auth } from '@/auth'
import { SecurityLogger } from '@/lib/security-logger'

/**
 * Debug endpoint to check S3 configuration
 * SECURITY: Requires admin authentication to prevent information disclosure
 */
export async function GET() {
  // SECURITY: Require authentication
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Require admin role - this endpoint exposes infrastructure details
  if (!session.user.isAdmin) {
    await SecurityLogger.logPermissionDenied(
      session.user.id,
      '/api/debug/s3-config',
      'admin_required'
    )
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const debugConfig = debugS3Config()
  return NextResponse.json(debugConfig)
}

