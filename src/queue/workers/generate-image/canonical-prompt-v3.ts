import { createHash } from 'node:crypto'

import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { CanonicalPromptState } from '@/types/workflow'

import { saveDebugJson } from './utils/debug-helpers'
import { composeElementContributions } from './utils/element-composition'
import { deepMergePromptObjects, stableStringify } from './utils/prompt-merge'

export interface CanonicalPromptDebugMetadata {
  conflictPaths: string[]
  sourceMarkers: Record<string, 'base' | 'person-phase' | 'composition-phase'>
  promptHash: string
}

export interface CanonicalPromptBuildInput {
  basePrompt: string
  styleSettings: PhotoStyleSettings
  demographics?: unknown
  hasFaceComposite: boolean
  hasBodyComposite: boolean
  generationId: string
  personId: string
  teamId?: string
  selfieS3Keys: string[]
  debugMode?: boolean
}

export interface CanonicalPromptBuildOutput {
  canonicalPrompt: Record<string, unknown>
  step1aArtifacts: CanonicalPromptState['step1aArtifacts']
  step2Artifacts: {
    mustFollowRules: string[]
    freedomRules: string[]
    payloadOverlay?: Record<string, unknown>
  }
  step3EvalArtifacts: CanonicalPromptState['step3EvalArtifacts']
  debugMetadata: CanonicalPromptDebugMetadata
}

function hashPrompt(prompt: Record<string, unknown>): string {
  const canonicalJson = stableStringify(prompt)
  return createHash('sha256').update(canonicalJson).digest('hex')
}

function parseBasePrompt(basePrompt: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(basePrompt) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Base prompt must be a JSON object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Canonical prompt builder failed to parse base prompt JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function buildSourceMarkers(
  basePrompt: Record<string, unknown>,
  personPayload?: Record<string, unknown>,
  compositionPayload?: Record<string, unknown>
): Record<string, 'base' | 'person-phase' | 'composition-phase'> {
  const markers: Record<string, 'base' | 'person-phase' | 'composition-phase'> = {}

  for (const key of Object.keys(basePrompt)) {
    markers[key] = 'base'
  }
  if (personPayload) {
    for (const key of Object.keys(personPayload)) {
      markers[key] = 'person-phase'
    }
  }
  if (compositionPayload) {
    for (const key of Object.keys(compositionPayload)) {
      markers[key] = 'composition-phase'
    }
  }

  return markers
}

export async function buildCanonicalPromptV3(
  input: CanonicalPromptBuildInput
): Promise<CanonicalPromptBuildOutput> {
  const {
    basePrompt,
    styleSettings,
    demographics,
    hasFaceComposite,
    hasBodyComposite,
    generationId,
    personId,
    teamId,
    selfieS3Keys,
    debugMode = false,
  } = input

  const start = Date.now()
  const parsedBasePrompt = parseBasePrompt(basePrompt)

  const baseContext = {
    selfieS3Keys,
    generationId,
    personId,
    teamId,
    demographics,
    hasFaceComposite,
    hasBodyComposite,
  }

  const personPhase = await composeElementContributions('person-generation', styleSettings, baseContext)
  // background-generation phase: collects branding data (scene.branding) for Step 0.
  // Note: preparedAssets are not available yet (pre-Step 0), so logo reference images won't be present,
  // but the branding config (placement, material, rules) will be populated.
  const backgroundPhase = await composeElementContributions('background-generation', styleSettings, baseContext)
  // Build order note:
  // canonical prompt is built before Step 0 preparation runs, so composition-phase contributions
  // cannot rely on preparedAssets here (they are not available yet).
  const compositionPhase = await composeElementContributions('composition', styleSettings, baseContext)
  const evaluationPhase = await composeElementContributions('evaluation', styleSettings, baseContext)

  const merged1 = deepMergePromptObjects(parsedBasePrompt, personPhase.payload)
  const merged2 = deepMergePromptObjects(merged1.merged, backgroundPhase.payload)
  const canonicalPrompt = merged2.merged

  const debugMetadata: CanonicalPromptDebugMetadata = {
    conflictPaths: [...merged1.debug.conflictPaths, ...merged2.debug.conflictPaths],
    sourceMarkers: buildSourceMarkers(parsedBasePrompt, personPhase.payload, compositionPhase.payload),
    promptHash: hashPrompt(canonicalPrompt),
  }

  const sourceMarkerSummary = Object.values(debugMetadata.sourceMarkers).reduce(
    (acc, marker) => {
      acc[marker] = (acc[marker] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  Logger.info('canonicalPromptBuilt', {
    generationId,
    promptHash: debugMetadata.promptHash,
    conflictCount: debugMetadata.conflictPaths.length,
    sourceMarkerSummary,
    durationMs: Date.now() - start,
  })

  const output: CanonicalPromptBuildOutput = {
    canonicalPrompt,
    step1aArtifacts: {
      mustFollowRules: personPhase.mustFollow,
      freedomRules: personPhase.freedom,
    },
    step2Artifacts: {
      mustFollowRules: compositionPhase.mustFollow,
      freedomRules: compositionPhase.freedom,
      payloadOverlay: compositionPhase.payload,
    },
    step3EvalArtifacts: {
      mustFollowRules: evaluationPhase.mustFollow,
      freedomRules: evaluationPhase.freedom,
    },
    debugMetadata,
  }

  await saveDebugJson(
    {
      canonicalPrompt,
      step1aArtifacts: output.step1aArtifacts,
      step2Artifacts: output.step2Artifacts,
      step3EvalArtifacts: output.step3EvalArtifacts,
      debugMetadata,
    },
    'canonical-prompt-debug',
    generationId,
    debugMode
  )

  return output
}

export function serializeCanonicalPromptState(
  buildOutput: CanonicalPromptBuildOutput
): CanonicalPromptState {
  return {
    prompt: JSON.stringify(buildOutput.canonicalPrompt),
    step1aArtifacts: buildOutput.step1aArtifacts,
    step2Artifacts: {
      mustFollowRules: buildOutput.step2Artifacts.mustFollowRules,
      freedomRules: buildOutput.step2Artifacts.freedomRules,
      payloadOverlay: buildOutput.step2Artifacts.payloadOverlay
        ? JSON.stringify(buildOutput.step2Artifacts.payloadOverlay)
        : undefined,
    },
    step3EvalArtifacts: buildOutput.step3EvalArtifacts,
    version: 1,
    promptHash: buildOutput.debugMetadata.promptHash,
    createdAt: new Date().toISOString(),
  }
}

export function restoreCanonicalPromptState(state: CanonicalPromptState): {
  canonicalPrompt: Record<string, unknown>
  step1aArtifacts: CanonicalPromptState['step1aArtifacts']
  step2Artifacts: {
    mustFollowRules: string[]
    freedomRules: string[]
    payloadOverlay?: Record<string, unknown>
  }
  step3EvalArtifacts: CanonicalPromptState['step3EvalArtifacts']
  promptHash: string
} {
  const parsedPrompt = parseBasePrompt(state.prompt)
  const parsedOverlay = state.step2Artifacts.payloadOverlay
    ? (JSON.parse(state.step2Artifacts.payloadOverlay) as Record<string, unknown>)
    : undefined

  return {
    canonicalPrompt: parsedPrompt,
    step1aArtifacts: state.step1aArtifacts,
    step2Artifacts: {
      mustFollowRules: state.step2Artifacts.mustFollowRules,
      freedomRules: state.step2Artifacts.freedomRules,
      payloadOverlay: parsedOverlay,
    },
    step3EvalArtifacts: state.step3EvalArtifacts,
    promptHash: state.promptHash,
  }
}

export function computePromptHash(prompt: Record<string, unknown>): string {
  return hashPrompt(prompt)
}
