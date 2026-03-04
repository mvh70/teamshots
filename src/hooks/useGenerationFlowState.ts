import { useCallback, useEffect, useMemo, useState } from 'react'
import { CustomizationStepsMeta, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'
import { hasSavedBeautificationSettings, STYLE_SETTINGS_CHANGED_EVENT } from '@/lib/clothing-colors-storage'

type FlowKey = 'fromGeneration' | 'openStartFlow' | 'pendingGeneration' | 'completedBeautification'
type IntroSeenKey = 'seenSelfieTips' | 'seenCustomizationIntro'
type StepsUpdater = number[] | ((prev: number[]) => number[])

interface GenerationFlowFlags {
  fromGeneration: boolean
  openStartFlow: boolean
  pendingGeneration: boolean
  completedBeautification: boolean
}

interface IntroSeenFlags {
  seenSelfieTips: boolean
  seenCustomizationIntro: boolean
}

const DEFAULT_FLAGS: GenerationFlowFlags = {
  fromGeneration: false,
  openStartFlow: false,
  pendingGeneration: false,
  completedBeautification: false
}

const DEFAULT_INTRO_FLAGS: IntroSeenFlags = {
  seenSelfieTips: false,
  seenCustomizationIntro: false
}

const CUSTOMIZATION_META_KEY = 'customizationStepsMeta'
const VISITED_STEPS_KEY = 'visitedCustomizationSteps'
const COMPLETED_STEPS_KEY = 'completedCustomizationSteps'

// Custom event name for notifying other hook instances about completed steps
const COMPLETED_STEPS_CHANGED_EVENT = 'completedStepsChanged'

function makeStorageKey(baseKey: string, flowScope?: string | null): string {
  return flowScope ? `${baseKey}:${flowScope}` : baseKey
}

function normalizeFlowScopeId(flowScope?: string | null): string {
  return flowScope ?? ''
}

interface FlowScopeEventDetail {
  flowScope?: string
}

function readCompletedSteps(flowScope?: string | null): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(makeStorageKey(COMPLETED_STEPS_KEY, flowScope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

function writeCompletedSteps(steps: number[], flowScope?: string | null): void {
  if (typeof window === 'undefined') return
  const storageKey = makeStorageKey(COMPLETED_STEPS_KEY, flowScope)
  if (steps.length > 0) {
    sessionStorage.setItem(storageKey, JSON.stringify(steps))
  } else {
    sessionStorage.removeItem(storageKey)
  }
  // Dispatch custom event to notify other hook instances in the same page
  window.dispatchEvent(
    new CustomEvent<FlowScopeEventDetail>(COMPLETED_STEPS_CHANGED_EVENT, {
      detail: { flowScope: normalizeFlowScopeId(flowScope) },
    })
  )
}

function readVisitedSteps(flowScope?: string | null): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(makeStorageKey(VISITED_STEPS_KEY, flowScope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

// Custom event name for notifying other hook instances
const VISITED_STEPS_CHANGED_EVENT = 'visitedStepsChanged'

function writeVisitedSteps(steps: number[], flowScope?: string | null): void {
  if (typeof window === 'undefined') return
  const storageKey = makeStorageKey(VISITED_STEPS_KEY, flowScope)
  if (steps.length > 0) {
    sessionStorage.setItem(storageKey, JSON.stringify(steps))
  } else {
    sessionStorage.removeItem(storageKey)
  }
  // Dispatch custom event to notify other hook instances in the same page
  window.dispatchEvent(
    new CustomEvent<FlowScopeEventDetail>(VISITED_STEPS_CHANGED_EVENT, {
      detail: { flowScope: normalizeFlowScopeId(flowScope) },
    })
  )
}

function readCustomizationMeta(flowScope?: string | null): CustomizationStepsMeta | null {
  if (typeof window === 'undefined') return null
  const storageKey = makeStorageKey(CUSTOMIZATION_META_KEY, flowScope)
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CustomizationStepsMeta
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.editableSteps === 'number' &&
      typeof parsed.allSteps === 'number' &&
      Array.isArray(parsed.lockedSteps)
    ) {
      // Validate that stepNames is present and has the right length
      // If it's missing or has wrong length, clear the cached data and return null
      // This forces a fresh computation from PhotoStyleSettings
      if (!Array.isArray(parsed.stepNames) || parsed.stepNames.length !== parsed.editableSteps) {
        sessionStorage.removeItem(storageKey)
        return null
      }
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

function writeCustomizationMeta(value: CustomizationStepsMeta | null, flowScope?: string | null): void {
  if (typeof window === 'undefined') return
  const storageKey = makeStorageKey(CUSTOMIZATION_META_KEY, flowScope)
  if (value) {
    sessionStorage.setItem(storageKey, JSON.stringify(value))
  } else {
    sessionStorage.removeItem(storageKey)
  }
}

function readFlag(key: FlowKey, flowScope?: string | null): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(makeStorageKey(key, flowScope)) === 'true'
}

function writeFlag(key: FlowKey, value: boolean, flowScope?: string | null): void {
  if (typeof window === 'undefined') return
  const storageKey = makeStorageKey(key, flowScope)
  if (value) {
    sessionStorage.setItem(storageKey, 'true')
  } else {
    sessionStorage.removeItem(storageKey)
  }
}

function readIntroFlag(key: IntroSeenKey, flowScope?: string | null): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(makeStorageKey(key, flowScope)) === 'true'
}

function writeIntroFlag(key: IntroSeenKey, value: boolean, flowScope?: string | null): void {
  if (typeof window === 'undefined') return
  const storageKey = makeStorageKey(key, flowScope)
  if (value) {
    sessionStorage.setItem(storageKey, 'true')
  } else {
    sessionStorage.removeItem(storageKey)
  }
}

// Helper to get initial state synchronously (for SSR-safe initialization)
function getInitialVisitedSteps(flowScope?: string | null): number[] {
  if (typeof window === 'undefined') return []
  return readVisitedSteps(flowScope)
}

function getInitialCompletedSteps(flowScope?: string | null): number[] {
  if (typeof window === 'undefined') return []
  return readCompletedSteps(flowScope)
}

function getInitialCustomizationMeta(flowScope?: string | null): CustomizationStepsMeta | null {
  if (typeof window === 'undefined') return null
  return readCustomizationMeta(flowScope)
}

function getInitialFlags(flowScope?: string | null): GenerationFlowFlags {
  if (typeof window === 'undefined') return DEFAULT_FLAGS
  return {
    fromGeneration: readFlag('fromGeneration', flowScope),
    openStartFlow: readFlag('openStartFlow', flowScope),
    pendingGeneration: readFlag('pendingGeneration', flowScope),
    completedBeautification: readFlag('completedBeautification', flowScope)
  }
}

function getInitialIntroFlags(flowScope?: string | null): IntroSeenFlags {
  if (typeof window === 'undefined') return DEFAULT_INTRO_FLAGS
  return {
    seenSelfieTips: readIntroFlag('seenSelfieTips', flowScope),
    seenCustomizationIntro: readIntroFlag('seenCustomizationIntro', flowScope)
  }
}

export interface UseGenerationFlowStateOptions {
  syncBeautificationFromSession?: boolean
  beautificationScope?: string | null
  flowScope?: string | null
}

export function useGenerationFlowState(options: UseGenerationFlowStateOptions = {}) {
  const {
    syncBeautificationFromSession = false,
    beautificationScope,
    flowScope,
  } = options
  const normalizedFlowScope = flowScope ?? null

  // Initialize state directly from sessionStorage to avoid flash of empty state
  const [flags, setFlags] = useState<GenerationFlowFlags>(() => getInitialFlags(normalizedFlowScope))
  const [introFlags, setIntroFlags] = useState<IntroSeenFlags>(() => getInitialIntroFlags(normalizedFlowScope))
  const [hydrated, setHydrated] = useState(false)
  const [customizationStepsMeta, setCustomizationStepsMetaState] = useState<CustomizationStepsMeta | null>(
    () => getInitialCustomizationMeta(normalizedFlowScope)
  )
  const [visitedSteps, setVisitedStepsState] = useState<number[]>(() => getInitialVisitedSteps(normalizedFlowScope))
  const [completedSteps, setCompletedStepsState] = useState<number[]>(() => getInitialCompletedSteps(normalizedFlowScope))

  const refreshFlags = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_FLAGS
    return {
      fromGeneration: readFlag('fromGeneration', normalizedFlowScope),
      openStartFlow: readFlag('openStartFlow', normalizedFlowScope),
      pendingGeneration: readFlag('pendingGeneration', normalizedFlowScope),
      completedBeautification: readFlag('completedBeautification', normalizedFlowScope)
    }
  }, [normalizedFlowScope])

  const refreshIntroFlags = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_INTRO_FLAGS
    return {
      seenSelfieTips: readIntroFlag('seenSelfieTips', normalizedFlowScope),
      seenCustomizationIntro: readIntroFlag('seenCustomizationIntro', normalizedFlowScope)
    }
  }, [normalizedFlowScope])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Avoid synchronous setState in effect body to satisfy hook linting rules.
    queueMicrotask(() => {
      setHydrated(true)
    })

    // Listen for custom events to sync state across hook instances in the same page
    const matchesScope = (detailScope?: string) =>
      (detailScope ?? '') === normalizeFlowScopeId(normalizedFlowScope)

    const handleVisitedStepsChange = (event: Event) => {
      const detail = (event as CustomEvent<FlowScopeEventDetail>).detail
      if (!matchesScope(detail?.flowScope)) return
      setVisitedStepsState(readVisitedSteps(normalizedFlowScope))
    }
    const handleCompletedStepsChange = (event: Event) => {
      const detail = (event as CustomEvent<FlowScopeEventDetail>).detail
      if (!matchesScope(detail?.flowScope)) return
      setCompletedStepsState(readCompletedSteps(normalizedFlowScope))
    }

    window.addEventListener(VISITED_STEPS_CHANGED_EVENT, handleVisitedStepsChange)
    window.addEventListener(COMPLETED_STEPS_CHANGED_EVENT, handleCompletedStepsChange)
    return () => {
      window.removeEventListener(VISITED_STEPS_CHANGED_EVENT, handleVisitedStepsChange)
      window.removeEventListener(COMPLETED_STEPS_CHANGED_EVENT, handleCompletedStepsChange)
    }
  }, [normalizedFlowScope])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setVisitedStepsState(readVisitedSteps(normalizedFlowScope))
      setCompletedStepsState(readCompletedSteps(normalizedFlowScope))
      setCustomizationStepsMetaState(readCustomizationMeta(normalizedFlowScope))
      setFlags(getInitialFlags(normalizedFlowScope))
      setIntroFlags(getInitialIntroFlags(normalizedFlowScope))
    })

    return () => {
      cancelled = true
    }
  }, [hydrated, normalizedFlowScope])

  useEffect(() => {
    if (!hydrated || !syncBeautificationFromSession || typeof window === 'undefined') return

    const normalizedScope = beautificationScope ?? null

    const syncCompletedFlag = () => {
      const hasSavedBeautification = hasSavedBeautificationSettings(normalizedScope)
      const currentFlag = readFlag('completedBeautification', normalizedFlowScope)

      if (currentFlag !== hasSavedBeautification) {
        writeFlag('completedBeautification', hasSavedBeautification, normalizedFlowScope)
        setFlags(refreshFlags())
      }
    }

    syncCompletedFlag()

    const handleStyleSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<{ contextId?: string | null }>).detail
      const changedScope = detail?.contextId ?? null
      if (changedScope !== normalizedScope) return
      syncCompletedFlag()
    }

    window.addEventListener(STYLE_SETTINGS_CHANGED_EVENT, handleStyleSettingsChange)
    return () => {
      window.removeEventListener(STYLE_SETTINGS_CHANGED_EVENT, handleStyleSettingsChange)
    }
  }, [hydrated, syncBeautificationFromSession, beautificationScope, normalizedFlowScope, refreshFlags])

  const markInFlow = useCallback(
    (options?: { pending?: boolean }) => {
      if (typeof window === 'undefined') return
      writeFlag('fromGeneration', true, normalizedFlowScope)
      writeFlag('openStartFlow', true, normalizedFlowScope)
      if (options?.pending) {
        writeFlag('pendingGeneration', true, normalizedFlowScope)
      }
      setFlags(refreshFlags())
    },
    [normalizedFlowScope, refreshFlags]
  )

  const clearFlow = useCallback(() => {
    if (typeof window === 'undefined') return
    ;(['fromGeneration', 'openStartFlow', 'pendingGeneration', 'completedBeautification'] as FlowKey[]).forEach(key =>
      sessionStorage.removeItem(makeStorageKey(key, normalizedFlowScope))
    )
    // Also clear visited steps so new generation flow starts fresh
    writeVisitedSteps([], normalizedFlowScope)
    setVisitedStepsState([])
    setFlags(DEFAULT_FLAGS)
  }, [normalizedFlowScope])

  const resetFlow = useCallback(() => {
    if (typeof window === 'undefined') return
    // Clear flow flags
    ;(['fromGeneration', 'openStartFlow', 'pendingGeneration', 'completedBeautification'] as FlowKey[]).forEach(key =>
      sessionStorage.removeItem(makeStorageKey(key, normalizedFlowScope))
    )
    // Clear intro flags to reset the flow for a fresh start
    ;(['seenSelfieTips', 'seenCustomizationIntro'] as IntroSeenKey[]).forEach(key =>
      sessionStorage.removeItem(makeStorageKey(key, normalizedFlowScope))
    )
    setFlags(DEFAULT_FLAGS)
    setIntroFlags(DEFAULT_INTRO_FLAGS)
  }, [normalizedFlowScope])

  const setPendingGeneration = useCallback(
    (value: boolean) => {
      writeFlag('pendingGeneration', value, normalizedFlowScope)
      setFlags(refreshFlags())
    },
    [normalizedFlowScope, refreshFlags]
  )

  const setOpenStartFlow = useCallback(
    (value: boolean) => {
      writeFlag('openStartFlow', value, normalizedFlowScope)
      setFlags(refreshFlags())
    },
    [normalizedFlowScope, refreshFlags]
  )

  const setCompletedBeautification = useCallback(
    (value: boolean) => {
      writeFlag('completedBeautification', value, normalizedFlowScope)
      setFlags(refreshFlags())
    },
    [normalizedFlowScope, refreshFlags]
  )

  const setCustomizationStepsMeta = useCallback(
    (meta?: CustomizationStepsMeta | null) => {
      const normalized = meta ?? null
      writeCustomizationMeta(normalized, normalizedFlowScope)
      setCustomizationStepsMetaState(normalized)
    },
    [normalizedFlowScope]
  )

  const setVisitedSteps = useCallback(
    (steps: StepsUpdater) => {
      setVisitedStepsState(prev => {
        const nextSteps = typeof steps === 'function' ? steps(prev) : steps
        writeVisitedSteps(nextSteps, normalizedFlowScope)
        return nextSteps
      })
    },
    [normalizedFlowScope]
  )

  const setCompletedSteps = useCallback(
    (steps: StepsUpdater) => {
      setCompletedStepsState(prev => {
        const nextSteps = typeof steps === 'function' ? steps(prev) : steps
        writeCompletedSteps(nextSteps, normalizedFlowScope)
        return nextSteps
      })
    },
    [normalizedFlowScope]
  )

  const markSelfieTipsSeen = useCallback(() => {
    writeIntroFlag('seenSelfieTips', true, normalizedFlowScope)
    setIntroFlags(refreshIntroFlags())
  }, [normalizedFlowScope, refreshIntroFlags])

  const markCustomizationIntroSeen = useCallback(() => {
    writeIntroFlag('seenCustomizationIntro', true, normalizedFlowScope)
    setIntroFlags(refreshIntroFlags())
  }, [normalizedFlowScope, refreshIntroFlags])

  // Stable actions object - callbacks don't change between renders
  const actions = useMemo(
    () => ({
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      setCompletedBeautification,
      // Convenience aliases for cleaner API
      markSeenSelfieTips: markSelfieTipsSeen,
      markSeenCustomizationIntro: markCustomizationIntroSeen,
      setCustomizationStepsMeta,
      setVisitedSteps,
      setCompletedSteps
    }),
    [
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      setCompletedBeautification,
      markSelfieTipsSeen,
      markCustomizationIntroSeen,
      setCompletedSteps,
      setCustomizationStepsMeta,
      setVisitedSteps
    ]
  )

  // Derive computed values (these are cheap to compute, no need to memoize)
  const inFlow = flags.fromGeneration || flags.openStartFlow || flags.pendingGeneration
  const hasCompletedBeautification = flags.completedBeautification
  const hasSeenSelfieTips = introFlags.seenSelfieTips
  const hasSeenCustomizationIntro = introFlags.seenCustomizationIntro
  const resolvedCustomizationMeta = customizationStepsMeta ?? DEFAULT_CUSTOMIZATION_STEPS_META

  // State object - only changes when actual state changes
  const state = useMemo(
    () => ({
      flags,
      introFlags,
      hydrated,
      inFlow,
      hasCompletedBeautification,
      hasSeenSelfieTips,
      hasSeenCustomizationIntro,
      customizationStepsMeta: resolvedCustomizationMeta,
      visitedSteps,
      completedSteps
    }),
    [flags, introFlags, hydrated, inFlow, hasCompletedBeautification, hasSeenSelfieTips, hasSeenCustomizationIntro, resolvedCustomizationMeta, visitedSteps, completedSteps]
  )

  // Combine state and actions - stable reference when neither changes
  return useMemo(
    () => ({ ...state, ...actions }),
    [state, actions]
  )
}

export type UseGenerationFlowStateReturn = ReturnType<typeof useGenerationFlowState>
