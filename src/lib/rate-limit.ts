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

export function getRateLimitIdentifier(request: NextRequest, scope: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  return `${scope}:${ip}`
}
