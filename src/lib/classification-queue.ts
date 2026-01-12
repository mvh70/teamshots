/**
 * Simple in-memory queue to limit concurrent classification requests
 * and prevent overwhelming the Gemini API.
 */

type ClassificationTask = () => Promise<void>

class ClassificationQueue {
  private queue: ClassificationTask[] = []
  private running = 0
  private readonly maxConcurrent = 3

  /**
   * Add a classification task to the queue.
   * It will be processed when a slot becomes available.
   */
  async enqueue(task: ClassificationTask): Promise<void> {
    // If we're already at max capacity, queue it
    if (this.running >= this.maxConcurrent) {
      return new Promise((resolve) => {
        this.queue.push(async () => {
          await task()
          resolve()
        })
      })
    }

    // Otherwise, run it immediately
    this.running++
    try {
      await task()
    } finally {
      this.running--
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

    const nextTask = this.queue.shift()
    if (nextTask) {
      this.running++
      nextTask()
        .catch((error) => {
          console.error('[ClassificationQueue] Task failed:', error)
        })
        .finally(() => {
          this.running--
          this.processNext()
        })
    }
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    }
  }
}

// Global singleton instance
export const classificationQueue = new ClassificationQueue()
