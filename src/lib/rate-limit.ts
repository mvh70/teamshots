import { redis } from '@/queue'
import { NextRequest } from 'next/server'

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000
  
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
