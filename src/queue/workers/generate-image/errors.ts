import { ImageEvaluationResult } from './evaluator'

export class EvaluationFailedError extends Error {
  public readonly evaluation: ImageEvaluationResult
  public readonly imageBase64: string
  public readonly generationId: string
  public readonly prompt: string
  public readonly attempt: number
  public readonly aspectRatio: string

  constructor(
    message: string,
    params: {
      evaluation: ImageEvaluationResult
      imageBase64: string
      generationId: string
      prompt: string
      attempt: number
      aspectRatio: string
    }
  ) {
    super(message)
    this.name = 'EvaluationFailedError'
    this.evaluation = params.evaluation
    this.imageBase64 = params.imageBase64
    this.generationId = params.generationId
    this.prompt = params.prompt
    this.attempt = params.attempt
    this.aspectRatio = params.aspectRatio
  }
}
