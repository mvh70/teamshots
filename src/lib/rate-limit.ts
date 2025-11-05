import { NextRequest } from 'next/server'
import { getRequestIp } from './server-headers'
import { RATE_LIMITS, RATE_BLOCK } from '@/config/rate-limit-config'

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

// Return the caller IP (best-effort). Separate helper so routes can check blocklist.
export async function getRequestIpString(): Promise<string> {
  try {
    return (await getRequestIp()) || 'unknown'
  } catch (error) {
    return 'unknown'
  }
}

// Redis helpers for temporary IP blocking
type RedisClientLike = {
  zremrangebyscore: (key: string, min: number, max: number) => Promise<number>
  zcard: (key: string) => Promise<number>
  zrange: (key: string, start: number, stop: number, withScores: string) => Promise<string[]>
  zadd: (key: string, score: number, member: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
  set: (key: string, value: string, mode?: string, duration?: number) => Promise<unknown>
  ttl: (key: string) => Promise<number>
}

async function getRedisTyped(): globalThis.Promise<RedisClientLike | null> {
  const instance = await getRedis()
  if (!instance) return null
  return instance as unknown as RedisClientLike
}

export async function getIpBlockTtlSeconds(ip: string): Promise<number> {
  const redis = await getRedisTyped()
  if (!redis) return 0
  const key = `rate_block:${ip}`
  const ttl = await redis.ttl(key)
  return ttl > 0 ? ttl : 0
}

export async function blockIp(ip: string, seconds: number): Promise<void> {
  const redis = await getRedisTyped()
  if (!redis) return
  const key = `rate_block:${ip}`
  // NX EX <seconds>
  try {
    await redis.set(key, '1', 'EX', seconds)
  } catch {
    // noop
  }
}

// Enforce rate limit with optional temporary IP blocking for invite-like flows
export async function enforceInviteRateLimitWithBlocking(
  request: NextRequest,
  scope: 'invite.validate' | 'invite.accept'
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number; blocked: boolean }> {
  // Allow all if Redis is not available (e.g., build time)
  const redis = await getRedisTyped()
  if (!redis) {
    return { allowed: true }
  }

  const ip = await getRequestIpString()
  const blockedTtl = await getIpBlockTtlSeconds(ip)
  if (blockedTtl > 0) {
    return { allowed: false, retryAfterSeconds: blockedTtl, blocked: true }
  }

  const now = Date.now()
  const id = `${scope}:${ip}`
  const key = `rate_limit:${id}`
  const soft = scope.endsWith('validate') ? RATE_LIMITS.inviteValidate : RATE_LIMITS.inviteAccept
  const hard = RATE_BLOCK.invite

  // Prune entries older than the larger window
  const pruneBefore = now - Math.max(soft.window, hard.window) * 1000
  await redis.zremrangebyscore(key, 0, pruneBefore)

  // Count requests in the last soft.window seconds
  const countAfterPrune = await redis.zcard(key)

  // Record this attempt
  await redis.zadd(key, now, `${now}-${Math.random()}`)
  await redis.expire(key, Math.max(soft.window, hard.window))

  const total = countAfterPrune + 1

  // If hits hard threshold within hard.window, block IP temporarily
  if (total >= hard.limit) {
    await blockIp(ip, hard.blockSeconds)
    return { allowed: false, retryAfterSeconds: hard.blockSeconds, blocked: true }
  }

  // Enforce soft rate limit
  if (total > soft.limit) {
    // Estimate reset as soft.window from now for simplicity
    return { allowed: false, retryAfterSeconds: soft.window, blocked: false }
  }

  return { allowed: true }
}
