import IORedis from 'ioredis'

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
}

const redis = new IORedis(connection)

async function clearRateLimits() {
  try {
    console.log('\n=== Clearing Rate Limits ===\n')

    // Get IP from command line args or clear all
    const ip = process.argv[2]
    
    if (ip) {
      console.log(`Clearing rate limits for IP: ${ip}\n`)
      
      // Clear rate limit keys for this IP
      const rateLimitKeys = [
        `rate_limit:invite.validate:${ip}`,
        `rate_limit:invite.accept:${ip}`,
      ]
      
      for (const key of rateLimitKeys) {
        const deleted = await redis.del(key)
        if (deleted > 0) {
          console.log(`✓ Cleared: ${key}`)
        } else {
          console.log(`  (not found): ${key}`)
        }
      }
      
      // Clear IP block key
      const blockKey = `rate_block:${ip}`
      const deleted = await redis.del(blockKey)
      if (deleted > 0) {
        console.log(`✓ Cleared IP block: ${blockKey}`)
      } else {
        console.log(`  (no block found): ${blockKey}`)
      }
    } else {
      console.log('Clearing ALL invite rate limit keys...\n')
      
      // Find all rate limit keys matching the pattern
      const rateLimitPattern = 'rate_limit:invite.*'
      const blockPattern = 'rate_block:*'
      
      // Get all matching keys
      const rateLimitKeys = await redis.keys(rateLimitPattern)
      const blockKeys = await redis.keys(blockPattern)
      
      if (rateLimitKeys.length > 0) {
        console.log(`Found ${rateLimitKeys.length} rate limit keys:`)
        for (const key of rateLimitKeys) {
          await redis.del(key)
          console.log(`✓ Cleared: ${key}`)
        }
      } else {
        console.log('No rate limit keys found')
      }
      
      if (blockKeys.length > 0) {
        console.log(`\nFound ${blockKeys.length} IP block keys:`)
        for (const key of blockKeys) {
          await redis.del(key)
          console.log(`✓ Cleared: ${key}`)
        }
      } else {
        console.log('\nNo IP block keys found')
      }
    }

    console.log('\n=== Done ===\n')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await redis.quit()
  }
}

clearRateLimits()

