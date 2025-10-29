import { NextRequest } from 'next/server'
import { getRequestIp } from './server-headers'

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

export async function getRateLimitIdentifier(request: NextRequest | unknown, scope: string): Promise<string> {
  try {
    // During build-time static analysis, request may be undefined
    if (!request || typeof request !== 'object') {
      return `${scope}:unknown`
    }
    
    // Use the server-headers utility for consistent IP extraction
    const ip = await getRequestIp() || 'unknown'
    return `${scope}:${ip}`
  } catch (error) {
    // If anything fails (e.g., during build-time analysis), return a safe fallback
    console.warn('Rate limit identifier generation failed:', error)
    return `${scope}:unknown`
  }
}
