import type { ImageEvaluationResult } from './evaluator'

export class EvaluationFailedError extends Error {
  public readonly evaluation: ImageEvaluationResult
  public readonly imageS3Key?: string
  public readonly generationId: string
  public readonly promptHash: string
  public readonly attempt: number
  public readonly aspectRatio: string

  constructor(
    message: string,
    params: {
      evaluation: ImageEvaluationResult
      imageS3Key?: string
      generationId: string
      promptHash: string
      attempt: number
      aspectRatio: string
    }
  ) {
    super(message)
    this.name = 'EvaluationFailedError'
    this.evaluation = params.evaluation
    this.imageS3Key = params.imageS3Key
    this.generationId = params.generationId
    this.promptHash = params.promptHash
    this.attempt = params.attempt
    this.aspectRatio = params.aspectRatio
  }
}
