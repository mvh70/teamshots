/**
 * Simple in-memory queue to limit concurrent classification requests
 * and prevent overwhelming the Gemini API.
 */

type ClassificationTask = () => Promise<void>

interface QueuedTask {
  task: ClassificationTask
  selfieId: string
}

class ClassificationQueue {
  private queue: QueuedTask[] = []
  private running = 0
  private readonly maxConcurrent = 3
  
  // Track which selfie IDs are currently being processed vs queued
  private activeSelfieIds = new Set<string>()
  private queuedSelfieIds = new Set<string>()

  /**
   * Add a classification task to the queue.
   * It will be processed when a slot becomes available.
   */
  async enqueue(task: ClassificationTask, selfieId: string): Promise<void> {
    // If we're already at max capacity, queue it
    if (this.running >= this.maxConcurrent) {
      this.queuedSelfieIds.add(selfieId)
      return new Promise((resolve) => {
        this.queue.push({
          task: async () => {
            await task()
            resolve()
          },
          selfieId,
        })
      })
    }

    // Otherwise, run it immediately
    this.running++
    this.activeSelfieIds.add(selfieId)
    try {
      await task()
    } finally {
      this.running--
      this.activeSelfieIds.delete(selfieId)
      this.processNext()
    }
  }

  /**
   * Process the next task in the queue if we have capacity
   */
  private processNext(): void {
    if (this.queue.length === 0 || this.running >= this.maxConcurrent) {
      return
    }

    const next = this.queue.shift()
    if (next) {
      this.running++
      this.queuedSelfieIds.delete(next.selfieId)
      this.activeSelfieIds.add(next.selfieId)
      next.task()
        .catch((error) => {
          console.error('[ClassificationQueue] Task failed:', error)
        })
        .finally(() => {
          this.running--
          this.activeSelfieIds.delete(next.selfieId)
          this.processNext()
        })
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      activeSelfieIds: Array.from(this.activeSelfieIds),
      queuedSelfieIds: Array.from(this.queuedSelfieIds),
    }
  }

  /**
   * Check if a selfie is currently being analyzed
   */
  isAnalyzing(selfieId: string): boolean {
    return this.activeSelfieIds.has(selfieId)
  }

  /**
   * Check if a selfie is queued for analysis
   */
  isQueued(selfieId: string): boolean {
    return this.queuedSelfieIds.has(selfieId)
  }
}

// Global singleton instance
export const classificationQueue = new ClassificationQueue()
