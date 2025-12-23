import { prisma, Prisma } from '@/lib/prisma'
import { getRequestIp, getRequestHeader } from '@/lib/server-headers'

export class SecurityLogger {
  static async logAuthAttempt(
    email: string,
    success: boolean
  ) {
    const ip = (await getRequestIp()) || 'unknown'
    const userAgent = await getRequestHeader('user-agent')
    
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
    resource: string
  ) {
    const ip = (await getRequestIp()) || 'unknown'
    
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
    identifier: string
  ) {
    await prisma.securityLog.create({
      data: {
        type: 'rate_limit_exceeded',
        email: identifier,
        ipAddress: (await getRequestIp()) || 'unknown',
        success: false,
      },
    })
  }
  
  static async logSuspiciousActivity(
    userId: string | null,
    reason: string,
    details: Record<string, unknown>
  ) {
    await prisma.securityLog.create({
      data: {
        type: 'suspicious_activity',
        userId,
        details: { reason, ...details } as Prisma.InputJsonValue,
        ipAddress: (await getRequestIp()) || 'unknown',
        success: false,
      },
    })
  }

  static async logFailedLogin(
    email: string,
    reason: string,
    details: Record<string, unknown>
  ) {
    const ip = (await getRequestIp()) || 'unknown'

    await prisma.securityLog.create({
      data: {
        type: 'failed_login',
        email,
        ipAddress: ip,
        success: false,
        action: reason,
        details: details as Prisma.InputJsonValue,
      },
    })
  }

  static async logImpersonation(
    adminUserId: string,
    adminEmail: string | null,
    impersonatedUserId: string,
    impersonatedUserEmail: string
  ) {
    const ip = (await getRequestIp()) || 'unknown'
    const userAgent = await getRequestHeader('user-agent')

    await prisma.securityLog.create({
      data: {
        type: 'impersonation',
        userId: adminUserId,
        email: adminEmail || undefined,
        ipAddress: ip,
        userAgent,
        success: true,
        action: 'impersonate',
        resource: impersonatedUserId,
        details: {
          impersonatedUserId,
          impersonatedUserEmail,
          timestamp: new Date().toISOString()
        } as Prisma.InputJsonValue
      },
    })
  }

}
