import { Logger } from '@/lib/logger'

export interface GenerationJobStatus {
  id: string | number | undefined
  progress: number
  message?: string
  attemptsMade: number
  processedOn: number | undefined
  finishedOn: number | undefined
  failedReason: string | undefined
}

export function shouldLoadGenerationJobStatus(status: string): boolean {
  return status === 'pending' || status === 'processing'
}

export async function getGenerationJobStatus({
  generationId,
  status,
  logContext,
}: {
  generationId: string
  status: string
  logContext: string
}): Promise<GenerationJobStatus | null> {
  if (!shouldLoadGenerationJobStatus(status)) {
    return null
  }

  try {
    const { imageGenerationQueue } = await import('@/queue')
    const job = await imageGenerationQueue.getJob(`gen-${generationId}`)

    if (!job) {
      return null
    }

    const progressData =
      typeof job.progress === 'object' && job.progress !== null
        ? (job.progress as { progress?: number; message?: string })
        : { progress: job.progress as number }

    return {
      id: job.id,
      progress:
        typeof progressData.progress === 'number'
          ? progressData.progress
          : typeof job.progress === 'number'
            ? job.progress
            : 0,
      message: typeof progressData.message === 'string' ? progressData.message : undefined,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    }
  } catch (error) {
    Logger.warn('Failed to get generation job status', {
      context: logContext,
      generationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
