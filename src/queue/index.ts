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
  styleSettings: Record<string, unknown>
  prompt: string
  providerOptions?: Record<string, unknown>
  creditSource: 'individual' | 'company'
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


