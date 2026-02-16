import { Logger } from '@/lib/logger'
import { Telemetry } from '@/lib/telemetry'

export type YesNo = 'YES' | 'NO'
export type YesNoUncertain = 'YES' | 'NO' | 'UNCERTAIN'
export type YesNoNA = 'YES' | 'NO' | 'N/A' | 'UNCERTAIN'

export function normalizeYesNo(value: unknown): YesNo {
  if (typeof value !== 'string') return 'NO'
  return value.trim().toUpperCase() === 'YES' ? 'YES' : 'NO'
}

export function normalizeYesNoUncertain(value: unknown): YesNoUncertain {
  if (typeof value !== 'string') return 'UNCERTAIN'
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'UNCERTAIN'
}

export function normalizeYesNoNA(value: unknown): YesNoNA {
  if (typeof value !== 'string') return 'N/A'
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  if (normalized === 'UNCERTAIN') return 'UNCERTAIN'
  return 'N/A'
}

export function getFaceSimilarityScore(value: YesNoUncertain | 'N/A' | undefined): number {
  switch (value) {
    case 'YES':
      return 100
    case 'UNCERTAIN':
      return 50
    case 'NO':
      return 0
    default:
      return -1
  }
}

export function parseLastJsonObject(text: string): string | null {
  const trimmed = text.trim()
  const jsonMatches = trimmed.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
  if (!jsonMatches || jsonMatches.length === 0) return null
  return jsonMatches[jsonMatches.length - 1] ?? null
}

export async function evaluateWithRetry<T>(
  maxRetries: number,
  evaluator: (attempt: number) => Promise<T | null>,
  loggerContext: { step: string; generationId?: string }
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const result = await evaluator(attempt)
    if (result) return result

    Logger.warn(`${loggerContext.step}: Parsing failed, retrying evaluation`, {
      evalAttempt: attempt,
      maxRetries,
      generationId: loggerContext.generationId,
    })
  }

  return null
}

export async function safeCostTrack(
  track: (() => Promise<void>) | undefined,
  context: { step: string; generationId?: string }
): Promise<void> {
  if (!track) return
  try {
    await track()
  } catch (error) {
    Telemetry.increment('generation.cost_tracking.failure')
    Logger.warn(`${context.step}: Cost tracking failed`, {
      generationId: context.generationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
