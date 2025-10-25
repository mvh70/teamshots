import { NextRequest } from 'next/server'

// Lazy import Redis to avoid build-time issues
let redis: unknown = null

async function getRedis(): Promise<unknown> {
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
    // Type assertion for Redis instance - we know it has these methods
    const redis = redisInstance as {
      zremrangebyscore: (key: string, min: number, max: number) => Promise<number>
      zcard: (key: string) => Promise<number>
      zrange: (key: string, start: number, stop: number, withScores: string) => Promise<string[]>
      zadd: (key: string, score: number, member: string) => Promise<number>
      expire: (key: string, seconds: number) => Promise<number>
    }
    
    // Use Redis sorted set for sliding window
    await redis.zremrangebyscore(key, 0, windowStart)
    const count = await redis.zcard(key)
    
    if (count >= limit) {
      const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const resetTime = oldestEntry[1] ? parseInt(oldestEntry[1]) + windowSeconds * 1000 : now + windowSeconds * 1000
      return { success: false, remaining: 0, reset: resetTime }
    }
    
    await redis.zadd(key, now, `${now}-${Math.random()}`)
    await redis.expire(key, windowSeconds)
    
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
    
    // Try to access headers safely
    const headers = req.headers
    if (!headers || typeof headers !== 'object') {
      return `${scope}:unknown`
    }
    
    // Check if headers has a get method and it's callable
    if (!('get' in headers) || typeof (headers as any).get !== 'function') {
      return `${scope}:unknown`
    }
    
    // Try to get IP from headers with additional safety
    try {
      const getMethod = (headers as any).get
      const forwardedFor = getMethod('x-forwarded-for')
      const realIp = getMethod('x-real-ip')
      
      const ip = forwardedFor?.split(',')[0]?.trim() || 
                 realIp?.trim() || 
                 'unknown'
      return `${scope}:${ip}`
    } catch (headerError) {
      console.warn('Header access failed:', headerError)
      return `${scope}:unknown`
    }
  } catch (error) {
    // If anything fails (e.g., during build-time analysis), return a safe fallback
    console.warn('Rate limit identifier generation failed:', error)
    return `${scope}:unknown`
  }
}
