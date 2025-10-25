import { NextRequest } from 'next/server'

// Lazy import Redis to avoid build-time issues
let redis: any = null

async function getRedis() {
  if (!redis) {
    try {
      const { redis: redisInstance } = await import('@/queue')
      redis = redisInstance
    } catch (error) {
      console.warn('Redis not available during build time:', error)
      return null
    }
  }
  return redis
}

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const redisInstance = await getRedis()
  
  // During build time or when Redis is not available, allow all requests
  if (!redisInstance) {
    return { success: true, remaining: limit, reset: Date.now() + windowSeconds * 1000 }
  }
  
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000
  
  try {
    // Use Redis sorted set for sliding window
    await redisInstance.zremrangebyscore(key, 0, windowStart)
    const count = await redisInstance.zcard(key)
    
    if (count >= limit) {
      const oldestEntry = await redisInstance.zrange(key, 0, 0, 'WITHSCORES')
      const resetTime = oldestEntry[1] ? parseInt(oldestEntry[1]) + windowSeconds * 1000 : now + windowSeconds * 1000
      return { success: false, remaining: 0, reset: resetTime }
    }
    
    await redisInstance.zadd(key, now, `${now}-${Math.random()}`)
    await redisInstance.expire(key, windowSeconds)
    
    return { success: true, remaining: limit - count - 1, reset: now + windowSeconds * 1000 }
  } catch (error) {
    console.warn('Rate limiting failed, allowing request:', error)
    return { success: true, remaining: limit, reset: now + windowSeconds * 1000 }
  }
}

export function getRateLimitIdentifier(request: NextRequest | unknown, scope: string): string {
  try {
    // During build-time static analysis, request may be undefined or headers may not exist
    if (!request || typeof request !== 'object') {
      return `${scope}:unknown`
    }
    
    // Type guard to check if request has headers property
    const req = request as Record<string, unknown>
    if (!('headers' in req) || !req.headers) {
      return `${scope}:build-time`
    }
    
    const headers = req.headers as { get?: (key: string) => string | null | undefined } | null
    if (!headers || typeof headers.get !== 'function') {
      return `${scope}:unknown`
    }
    
    const ip = headers.get('x-forwarded-for')?.split(',')[0] || 
               headers.get('x-real-ip') || 
               'unknown'
    return `${scope}:${ip}`
  } catch {
    // If anything fails (e.g., during build-time analysis), return a safe fallback
    return `${scope}:unknown`
  }
}
