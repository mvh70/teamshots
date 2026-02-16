import { z } from 'zod'

import {
  getStep0BrandingEvalActiveCriteria,
  getStep0BrandingEvalCandidateDescription,
  getStep0BrandingEvalLogoReferenceDescription,
  type Step0BrandingEvalCriterion,
  type Step0BrandingEvalScenario,
} from '@/domain/style/elements/branding/prompt'
import { Logger } from '@/lib/logger'
import { detectImageFormat } from '@/lib/image-format'
import { hasValue } from '@/domain/style/elements/base/element-types'
import type { PreparedAsset } from '@/domain/style/elements/composition'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'

import { AI_CONFIG, EVALUATION_CONFIG, STAGE_MODEL } from '../config'
import { generateTextWithGemini, type GeminiReferenceImage } from '../gemini'
import { logPrompt } from '../utils/logging'
import {
  normalizeYesNoNA,
  parseLastJsonObject,
  safeCostTrack,
  type YesNoNA,
} from '../utils/evaluation-helpers'
import { buildStep0EvalPrompt } from './prompts/v3-step0-eval-prompt'
import type { CostTrackingHandler } from '../workflow-v3'

type Step0EvalScenario = 'clothing' | 'background' | 'none'
type ActiveStep0EvalScenario = Exclude<Step0EvalScenario, 'none'>

type Step0EvalValue = YesNoNA

interface Step0StructuredEvaluation {
  logo_visible: Step0EvalValue
  logo_accurate: Step0EvalValue
  logo_placement: Step0EvalValue
  logo_integrated: Step0EvalValue
  clothing_logo_no_overflow: Step0EvalValue
  explanations: Record<string, string>
}

interface Step0ScenarioContext {
  scenario: ActiveStep0EvalScenario
  assetKey: string
  asset: PreparedAsset
  logoIdentifier?: string
}

function extensionFromMimeType(mimeType?: string): string {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  return 'jpg'
}

export interface V3Step0EvalInput {
  styleSettings: PhotoStyleSettings
  preparedAssets?: Map<string, PreparedAsset>
  downloadAsset: DownloadAssetFn
  generationId?: string
  onCostTracking?: CostTrackingHandler
}

export interface V3Step0EvalOutput {
  evaluation: {
    status: 'Approved' | 'Not Approved'
    reason: string
    scenario: Step0EvalScenario
    failedAssetKeys: string[]
    structuredEvaluation?: Step0StructuredEvaluation
    rawResponse?: unknown
  }
}

const structuredSchema = z.object({
  logo_visible: z.unknown().optional(),
  logo_accurate: z.unknown().optional(),
  logo_placement: z.unknown().optional(),
  logo_integrated: z.unknown().optional(),
  clothing_logo_no_overflow: z.unknown().optional(),
  explanations: z.record(z.string(), z.string().max(500)).optional(),
})

async function toEvaluationBufferImage(
  buffer: Buffer,
  mimeTypeHint?: string
): Promise<{ base64: string; mimeType: string }> {
  if (mimeTypeHint && mimeTypeHint.startsWith('image/')) {
    return {
      base64: buffer.toString('base64'),
      mimeType: mimeTypeHint,
    }
  }

  const detected = await detectImageFormat(buffer)
  return {
    base64: buffer.toString('base64'),
    mimeType: detected.mimeType,
  }
}

async function resolveScenarioContext(
  styleSettings: PhotoStyleSettings,
  preparedAssets?: Map<string, PreparedAsset>
): Promise<Step0ScenarioContext | null> {
  const brandingValue =
    styleSettings.branding && hasValue(styleSettings.branding) ? styleSettings.branding.value : undefined

  if (!brandingValue || brandingValue.type !== 'include') {
    return null
  }

  let clothingOverlayEntry:
    | { key: string; asset: PreparedAsset }
    | undefined
  if (preparedAssets) {
    for (const [key, asset] of preparedAssets.entries()) {
      const metadata = asset.data.metadata as Record<string, unknown> | undefined
      if (
        asset.assetType === 'overlay' &&
        asset.data.base64 &&
        metadata?.brandingPosition === 'clothing'
      ) {
        clothingOverlayEntry = { key, asset }
        break
      }
    }
  }

  if (brandingValue.position === 'clothing' && clothingOverlayEntry) {
    return {
      scenario: 'clothing',
      assetKey: clothingOverlayEntry.key,
      asset: clothingOverlayEntry.asset,
      logoIdentifier: brandingValue.logoAssetId ?? brandingValue.logoKey,
    }
  }

  let preparedBackgroundEntry:
    | { key: string; asset: PreparedAsset; metadata?: Record<string, unknown> }
    | undefined
  if (preparedAssets) {
    for (const [key, asset] of preparedAssets.entries()) {
      const metadata = asset.data.metadata as Record<string, unknown> | undefined
      const preBrandedWithLogo = metadata?.preBrandedWithLogo === true
      const preBrandedPosition = metadata?.preBrandedPosition
      if (
        asset.assetType === 'custom-background' &&
        asset.data.base64 &&
        preBrandedWithLogo &&
        (preBrandedPosition === 'background' || preBrandedPosition === 'elements')
      ) {
        preparedBackgroundEntry = { key, asset, metadata }
        break
      }
    }
  }

  if (
    (brandingValue.position === 'background' || brandingValue.position === 'elements') &&
    preparedBackgroundEntry
  ) {
    return {
      scenario: 'background',
      assetKey: preparedBackgroundEntry.key,
      asset: preparedBackgroundEntry.asset,
      logoIdentifier:
        (preparedBackgroundEntry.metadata?.logoIdentifier as string | undefined) ??
        brandingValue.logoAssetId ??
        brandingValue.logoKey,
    }
  }

  return null
}

async function resolveLogoReference(
  scenarioContext: Step0ScenarioContext,
  preparedAssets: Map<string, PreparedAsset> | undefined,
  downloadAsset: DownloadAssetFn,
  generationId?: string
): Promise<{ base64: string; mimeType: string; sourceName?: string } | null> {
  let preparedLogo: PreparedAsset | undefined
  if (preparedAssets) {
    for (const asset of preparedAssets.values()) {
      if (asset.assetType === 'logo' && asset.data.base64) {
        preparedLogo = asset
        break
      }
    }
  }

  if (preparedLogo?.data.base64) {
    return {
      base64: preparedLogo.data.base64,
      mimeType: preparedLogo.data.mimeType || 'image/png',
      sourceName: preparedLogo.data.s3Key || 'branding-logo',
    }
  }

  if (scenarioContext.scenario === 'background' && scenarioContext.logoIdentifier) {
    try {
      const downloaded = await downloadAsset(scenarioContext.logoIdentifier)
      if (downloaded?.base64) {
        return {
          base64: downloaded.base64,
          mimeType: downloaded.mimeType || 'image/png',
          sourceName: scenarioContext.logoIdentifier,
        }
      }
    } catch (error) {
      Logger.warn('V3 Step 0 Eval: Failed to download logo reference for background branding', {
        generationId,
        logoIdentifier: scenarioContext.logoIdentifier,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return null
}

function parseStructuredEvaluation(
  text: string,
  scenario: ActiveStep0EvalScenario
): Step0StructuredEvaluation | null {
  const jsonText = parseLastJsonObject(text)
  if (!jsonText) {
    Logger.warn('V3 Step 0 Eval: No JSON found in evaluation response', {
      responsePreview: text.substring(0, 500),
    })
    return null
  }

  try {
    const parsedRaw = JSON.parse(jsonText) as unknown
    const parsed = structuredSchema.parse(parsedRaw)

    return {
      logo_visible: normalizeYesNoNA(parsed.logo_visible),
      logo_accurate: normalizeYesNoNA(parsed.logo_accurate),
      logo_placement: scenario === 'clothing' ? normalizeYesNoNA(parsed.logo_placement) : 'N/A',
      logo_integrated: scenario === 'background' ? normalizeYesNoNA(parsed.logo_integrated) : 'N/A',
      clothing_logo_no_overflow:
        scenario === 'clothing' ? normalizeYesNoNA(parsed.clothing_logo_no_overflow) : 'N/A',
      explanations: parsed.explanations || {},
    }
  } catch (error) {
    Logger.warn('V3 Step 0 Eval: Failed to parse structured evaluation JSON', {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: text.substring(0, 500),
    })
    return null
  }
}

export async function executeV3Step0Eval(input: V3Step0EvalInput): Promise<V3Step0EvalOutput> {
  const scenarioContext = await resolveScenarioContext(input.styleSettings, input.preparedAssets)

  if (!scenarioContext) {
    return {
      evaluation: {
        status: 'Approved',
        reason: 'No Step 0 branding assets require evaluation.',
        scenario: 'none',
        failedAssetKeys: [],
      },
    }
  }

  const logoReference = await resolveLogoReference(
    scenarioContext,
    input.preparedAssets,
    input.downloadAsset,
    input.generationId
  )

  if (!logoReference) {
    return {
      evaluation: {
        status: 'Not Approved',
        reason: 'Step 0 branding evaluation requires a logo reference, but none was available.',
        scenario: scenarioContext.scenario,
        failedAssetKeys: [scenarioContext.assetKey],
      },
    }
  }

  const candidateBase64 = scenarioContext.asset.data.base64
  if (!candidateBase64) {
    return {
      evaluation: {
        status: 'Not Approved',
        reason: 'Step 0 branding evaluation requires candidate asset base64, but it was missing.',
        scenario: scenarioContext.scenario,
        failedAssetKeys: [scenarioContext.assetKey],
      },
    }
  }

  const candidateBuffer = Buffer.from(candidateBase64, 'base64')
  const evalCandidate = await toEvaluationBufferImage(
    candidateBuffer,
    scenarioContext.asset.data.mimeType || undefined
  )
  const evalLogo = await toEvaluationBufferImage(
    Buffer.from(logoReference.base64, 'base64'),
    logoReference.mimeType || undefined
  )

  const evalPromptText = buildStep0EvalPrompt(scenarioContext.scenario as Step0BrandingEvalScenario)
  logPrompt('V3 Step 0 Eval', evalPromptText, input.generationId)

  const evalImages: GeminiReferenceImage[] = [
    {
      name: `${scenarioContext.assetKey}.${extensionFromMimeType(evalCandidate.mimeType)}`,
      mimeType: evalCandidate.mimeType,
      base64: evalCandidate.base64,
      description: getStep0BrandingEvalCandidateDescription(
        scenarioContext.scenario as Step0BrandingEvalScenario
      ),
    },
    {
      name:
        logoReference.sourceName ||
        `logo-reference.${extensionFromMimeType(evalLogo.mimeType)}`,
      mimeType: evalLogo.mimeType,
      base64: evalLogo.base64,
      description: getStep0BrandingEvalLogoReferenceDescription(),
    },
  ]

  let rawResponse: unknown = null
  let structuredEvaluation: Step0StructuredEvaluation | null = null
  let evalDurationMs = 0
  let usageMetadata: { inputTokens?: number; outputTokens?: number } | undefined
  let providerUsed: 'vertex' | 'gemini-rest' | 'openrouter' | undefined

  for (let evalAttempt = 1; evalAttempt <= EVALUATION_CONFIG.MAX_EVAL_RETRIES; evalAttempt += 1) {
    const evalStartTime = Date.now()
    rawResponse = null
    structuredEvaluation = null

    try {
      const response = await generateTextWithGemini(evalPromptText, evalImages, {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE,
        stage: 'EVALUATION',
      })

      evalDurationMs = response.usage.durationMs
      usageMetadata = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      }
      providerUsed = response.providerUsed
      rawResponse = response.text

      if (response.text) {
        structuredEvaluation = parseStructuredEvaluation(response.text, scenarioContext.scenario)
      }

      if (structuredEvaluation) {
        break
      }

      Logger.warn('V3 Step 0 Eval: Parsing failed, retrying evaluation', {
        evalAttempt,
        maxRetries: EVALUATION_CONFIG.MAX_EVAL_RETRIES,
        rawResponsePreview:
          typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : String(rawResponse),
      })
    } catch (error) {
      evalDurationMs = Date.now() - evalStartTime
      const message = error instanceof Error ? error.message : String(error)

      await safeCostTrack(
        input.onCostTracking
          ? () =>
              input.onCostTracking!({
                stepName: 'step0-eval',
                reason: 'evaluation',
                result: 'failure',
                model: STAGE_MODEL.EVALUATION,
                provider: providerUsed,
                durationMs: evalDurationMs,
                errorMessage: message,
              })
          : undefined,
        { step: 'V3 Step 0 Eval', generationId: input.generationId }
      )

      if (evalAttempt === EVALUATION_CONFIG.MAX_EVAL_RETRIES) {
        throw error
      }
    }
  }

  if (!structuredEvaluation) {
    const rejectionReason = `Step 0 evaluation did not return valid JSON after ${EVALUATION_CONFIG.MAX_EVAL_RETRIES} attempts.`

    await safeCostTrack(
      input.onCostTracking
        ? () =>
            input.onCostTracking!({
              stepName: 'step0-eval',
              reason: 'evaluation',
              result: 'success',
              model: STAGE_MODEL.EVALUATION,
              provider: providerUsed,
              inputTokens: usageMetadata?.inputTokens,
              outputTokens: usageMetadata?.outputTokens,
              durationMs: evalDurationMs,
              evaluationStatus: 'rejected',
              rejectionReason,
            })
        : undefined,
      { step: 'V3 Step 0 Eval', generationId: input.generationId }
    )

    return {
      evaluation: {
        status: 'Not Approved',
        reason: rejectionReason,
        scenario: scenarioContext.scenario,
        failedAssetKeys: [scenarioContext.assetKey],
        rawResponse: typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : rawResponse,
      },
    }
  }

  const activeCriteria = getStep0BrandingEvalActiveCriteria(
    scenarioContext.scenario as Step0BrandingEvalScenario
  ) as Step0BrandingEvalCriterion[]
  const failedCriteria = activeCriteria
    .filter((criterion) => structuredEvaluation![criterion] !== 'YES')
    .map((criterion) => {
      const value = structuredEvaluation![criterion]
      const explanation = structuredEvaluation!.explanations[criterion] || 'No explanation provided'
      return `${criterion}: ${value} (${explanation})`
    })

  const finalStatus: 'Approved' | 'Not Approved' = failedCriteria.length === 0 ? 'Approved' : 'Not Approved'
  const finalReason =
    failedCriteria.length === 0
      ? 'All Step 0 branding criteria met'
      : failedCriteria.join(' | ')

  await safeCostTrack(
    input.onCostTracking
      ? () =>
          input.onCostTracking!({
            stepName: 'step0-eval',
            reason: 'evaluation',
            result: 'success',
            model: STAGE_MODEL.EVALUATION,
            provider: providerUsed,
            inputTokens: usageMetadata?.inputTokens,
            outputTokens: usageMetadata?.outputTokens,
            durationMs: evalDurationMs,
            evaluationStatus: finalStatus === 'Approved' ? 'approved' : 'rejected',
            rejectionReason: finalStatus === 'Not Approved' ? finalReason : undefined,
          })
      : undefined,
    { step: 'V3 Step 0 Eval', generationId: input.generationId }
  )

  return {
    evaluation: {
      status: finalStatus,
      reason: finalReason,
      scenario: scenarioContext.scenario,
      failedAssetKeys: finalStatus === 'Approved' ? [] : [scenarioContext.assetKey],
      structuredEvaluation,
      rawResponse: typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : rawResponse,
    },
  }
}
