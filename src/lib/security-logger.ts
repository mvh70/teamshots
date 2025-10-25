import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export class SecurityLogger {
  static async logAuthAttempt(
    email: string,
    success: boolean,
    request: NextRequest
  ) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const userAgent = request.headers.get('user-agent')
    
    await prisma.securityLog.create({
      data: {
        type: 'auth_attempt',
        email,
        success,
        ipAddress: ip,
        userAgent,
      },
    })
  }
  
  static async logPermissionDenied(
    userId: string,
    action: string,
    resource: string,
    request: NextRequest
  ) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    await prisma.securityLog.create({
      data: {
        type: 'permission_denied',
        userId,
        action,
        resource,
        ipAddress: ip,
        success: false,
      },
    })
  }
  
  static async logRateLimitExceeded(
    identifier: string,
    request: NextRequest
  ) {
    await prisma.securityLog.create({
      data: {
        type: 'rate_limit_exceeded',
        email: identifier,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        success: false,
      },
    })
  }
  
  static async logSuspiciousActivity(
    userId: string | null,
    reason: string,
    details: Record<string, unknown>,
    request: NextRequest
  ) {
    await prisma.securityLog.create({
      data: {
        type: 'suspicious_activity',
        userId,
        details: { reason, ...details },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        success: false,
      },
    })
  }

}
