/**
 * BullMQ Queue Configuration
 *
 * Centralized queue setup for background job processing
 */

import { Queue, type ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { Env } from '@/lib/env'

// Redis connection configuration
const connection: ConnectionOptions = {
  host: Env.string('REDIS_HOST', '127.0.0.1'),
  port: Env.number('REDIS_PORT', 6379),
  password: Env.string('REDIS_PASSWORD', ''),
  enableReadyCheck: false,
  // Let ioredis handle retries internally; BullMQ recommends null here to avoid warnings
  // https://docs.bullmq.io/guide/connections
  maxRetriesPerRequest: null,
}

// Create Redis connection instance (can be passed to Workers/Queues)
export const redis = new IORedis(connection)

// Queue names
export const QUEUE_NAMES = {
  IMAGE_GENERATION: 'image-generation',
  BACKGROUND_REMOVAL: 'background-removal',
  EMAIL_SENDING: 'email-sending',
} as const

// Job data interfaces
export interface ImageGenerationJobData {
  generationId: string
  personId: string
  userId?: string
  selfieId: string
  selfieS3Key: string
  selfieS3Keys?: string[] // Optional array of multiple selfies for multi-selfie generation
  styleSettings: Record<string, unknown>
  prompt: string
  providerOptions?: Record<string, unknown>
  creditSource: 'individual' | 'team'
}

export interface BackgroundRemovalJobData {
  selfieId: string
  s3Key: string
  options?: Record<string, unknown>
}

export interface EmailSendingJobData {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}

// Queue instances
export const imageGenerationQueue = new Queue<ImageGenerationJobData>(QUEUE_NAMES.IMAGE_GENERATION, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

export const backgroundRemovalQueue = new Queue<BackgroundRemovalJobData>(QUEUE_NAMES.BACKGROUND_REMOVAL, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
})

export const emailSendingQueue = new Queue<EmailSendingJobData>(QUEUE_NAMES.EMAIL_SENDING, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
})

// Queue schedulers (prevents stalled jobs)
// BullMQ v5 no longer requires a separate QueueScheduler; scheduling is handled internally.

// Queue health check
export async function getQueueHealth() {
  try {
    const [imageGenStats, backgroundRemovalStats, emailStats] = await Promise.all([
      imageGenerationQueue.getJobCounts(),
      backgroundRemovalQueue.getJobCounts(),
      emailSendingQueue.getJobCounts(),
    ])

    return {
      status: 'healthy',
      queues: {
        imageGeneration: imageGenStats,
        backgroundRemoval: backgroundRemovalStats,
        emailSending: emailStats,
      },
      redis: {
        status: redis.status,
        connected: redis.status === 'ready',
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Graceful shutdown helpers (optional for local dev)
export async function closeQueues() {
  await Promise.all([
    imageGenerationQueue.close(),
    backgroundRemovalQueue.close(),
    emailSendingQueue.close(),
    redis.disconnect(),
  ])
}

// Initialize queues (optional utility)
export async function initializeQueues() {
  // Ensure Redis is reachable
  await redis.ping()
}

// Clear queue utilities
export async function clearImageGenerationQueue(options?: { force?: boolean }) {
  const force = options?.force ?? false
  
  if (force) {
    // Completely obliterate the queue (removes all jobs, including completed/failed)
    await imageGenerationQueue.obliterate({ force: true })
    console.log('✅ Image generation queue cleared (obliterated)')
  } else {
    // Remove all waiting/delayed jobs (safer - keeps completed/failed for history)
    const waiting = await imageGenerationQueue.getWaiting()
    const delayed = await imageGenerationQueue.getDelayed()
    const active = await imageGenerationQueue.getActive()
    
    // Remove waiting and delayed jobs (these are not locked)
    await Promise.allSettled([
      ...waiting.map(job => job.remove()),
      ...delayed.map(job => job.remove()),
    ])
    
    // For active jobs, handle locked jobs gracefully
    const activeResults = await Promise.allSettled(
      active.map(async (job) => {
        try {
          await job.remove()
        } catch (error) {
          // If job is locked, try to fail it first, then remove
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('locked')) {
            try {
              await job.moveToFailed(new Error('Manually cancelled'), '0')
              await job.remove()
            } catch {
              // If we can't fail it either, skip it
              throw new Error(`Job ${job.id} is locked and cannot be removed`)
            }
          } else {
            throw error
          }
        }
      })
    )
    
    const activeRemoved = activeResults.filter(r => r.status === 'fulfilled').length
    const activeLocked = activeResults.filter(r => r.status === 'rejected').length
    
    let message = `✅ Removed ${waiting.length} waiting, ${delayed.length} delayed, and ${activeRemoved}/${active.length} active jobs`
    if (activeLocked > 0) {
      message += ` (${activeLocked} locked - use force option to obliterate)`
    }
    console.log(message)
  }
}

export async function clearAllQueues(options?: { force?: boolean }) {
  const force = options?.force ?? false
  
  await Promise.all([
    clearImageGenerationQueue({ force }),
    force ? backgroundRemovalQueue.obliterate({ force: true }) : Promise.resolve(),
    force ? emailSendingQueue.obliterate({ force: true }) : Promise.resolve(),
  ])
  
  console.log('✅ All queues cleared')
}


