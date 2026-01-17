import { useCallback, useEffect, useMemo, useState } from 'react'
import { CustomizationStepsMeta, DEFAULT_CUSTOMIZATION_STEPS_META } from '@/lib/customizationSteps'

type FlowKey = 'fromGeneration' | 'openStartFlow' | 'pendingGeneration'
type IntroSeenKey = 'seenSelfieTips' | 'seenCustomizationIntro'

interface GenerationFlowFlags {
  fromGeneration: boolean
  openStartFlow: boolean
  pendingGeneration: boolean
}

interface IntroSeenFlags {
  seenSelfieTips: boolean
  seenCustomizationIntro: boolean
}

const DEFAULT_FLAGS: GenerationFlowFlags = {
  fromGeneration: false,
  openStartFlow: false,
  pendingGeneration: false
}

const DEFAULT_INTRO_FLAGS: IntroSeenFlags = {
  seenSelfieTips: false,
  seenCustomizationIntro: false
}

const CUSTOMIZATION_META_KEY = 'customizationStepsMeta'
const VISITED_STEPS_KEY = 'visitedCustomizationSteps'

function readVisitedSteps(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(VISITED_STEPS_KEY)
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

function writeVisitedSteps(steps: number[]): void {
  if (typeof window === 'undefined') return
  if (steps.length > 0) {
    sessionStorage.setItem(VISITED_STEPS_KEY, JSON.stringify(steps))
  } else {
    sessionStorage.removeItem(VISITED_STEPS_KEY)
  }
  // Dispatch custom event to notify other hook instances in the same page
  window.dispatchEvent(new CustomEvent(VISITED_STEPS_CHANGED_EVENT))
}

function readCustomizationMeta(): CustomizationStepsMeta | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CUSTOMIZATION_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CustomizationStepsMeta
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.editableSteps === 'number' &&
      typeof parsed.allSteps === 'number' &&
      Array.isArray(parsed.lockedSteps)
    ) {
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

function writeCustomizationMeta(value: CustomizationStepsMeta | null): void {
  if (typeof window === 'undefined') return
  if (value) {
    sessionStorage.setItem(CUSTOMIZATION_META_KEY, JSON.stringify(value))
  } else {
    sessionStorage.removeItem(CUSTOMIZATION_META_KEY)
  }
}

function readFlag(key: FlowKey): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(key) === 'true'
}

function writeFlag(key: FlowKey, value: boolean): void {
  if (typeof window === 'undefined') return
  if (value) {
    sessionStorage.setItem(key, 'true')
  } else {
    sessionStorage.removeItem(key)
  }
}

function readIntroFlag(key: IntroSeenKey): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(key) === 'true'
}

function writeIntroFlag(key: IntroSeenKey, value: boolean): void {
  if (typeof window === 'undefined') return
  if (value) {
    sessionStorage.setItem(key, 'true')
  } else {
    sessionStorage.removeItem(key)
  }
}

// Helper to get initial state synchronously (for SSR-safe initialization)
function getInitialVisitedSteps(): number[] {
  if (typeof window === 'undefined') return []
  return readVisitedSteps()
}

function getInitialCustomizationMeta(): CustomizationStepsMeta | null {
  if (typeof window === 'undefined') return null
  return readCustomizationMeta()
}

export function useGenerationFlowState() {
  // Initialize state directly from sessionStorage to avoid flash of empty state
  const [flags, setFlags] = useState<GenerationFlowFlags>(DEFAULT_FLAGS)
  const [introFlags, setIntroFlags] = useState<IntroSeenFlags>(DEFAULT_INTRO_FLAGS)
  const [hydrated, setHydrated] = useState(false)
  const [customizationStepsMeta, setCustomizationStepsMetaState] = useState<CustomizationStepsMeta | null>(getInitialCustomizationMeta)
  const [visitedSteps, setVisitedStepsState] = useState<number[]>(getInitialVisitedSteps)

  const refreshFlags = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_FLAGS
    return {
      fromGeneration: readFlag('fromGeneration'),
      openStartFlow: readFlag('openStartFlow'),
      pendingGeneration: readFlag('pendingGeneration')
    }
  }, [])

  const refreshIntroFlags = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_INTRO_FLAGS
    return {
      seenSelfieTips: readIntroFlag('seenSelfieTips'),
      seenCustomizationIntro: readIntroFlag('seenCustomizationIntro')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setFlags(refreshFlags())
    setIntroFlags(refreshIntroFlags())
    setCustomizationStepsMetaState(readCustomizationMeta())
    setVisitedStepsState(readVisitedSteps())
    setHydrated(true)

    // Listen for custom events to sync state across hook instances in the same page
    const handleVisitedStepsChange = () => {
      setVisitedStepsState(readVisitedSteps())
    }

    window.addEventListener(VISITED_STEPS_CHANGED_EVENT, handleVisitedStepsChange)
    return () => window.removeEventListener(VISITED_STEPS_CHANGED_EVENT, handleVisitedStepsChange)
  }, [refreshFlags, refreshIntroFlags])

  const markInFlow = useCallback(
    (options?: { pending?: boolean }) => {
      if (typeof window === 'undefined') return
      writeFlag('fromGeneration', true)
      writeFlag('openStartFlow', true)
      if (options?.pending) {
        writeFlag('pendingGeneration', true)
      }
      setFlags(refreshFlags())
    },
    [refreshFlags]
  )

  const clearFlow = useCallback(() => {
    if (typeof window === 'undefined') return
    ;(['fromGeneration', 'openStartFlow', 'pendingGeneration'] as FlowKey[]).forEach(key =>
      sessionStorage.removeItem(key)
    )
    // Also clear visited steps so new generation flow starts fresh
    writeVisitedSteps([])
    setVisitedStepsState([])
    setFlags(DEFAULT_FLAGS)
  }, [])

  const resetFlow = useCallback(() => {
    if (typeof window === 'undefined') return
    // Clear flow flags
    ;(['fromGeneration', 'openStartFlow', 'pendingGeneration'] as FlowKey[]).forEach(key =>
      sessionStorage.removeItem(key)
    )
    // Clear intro flags to reset the flow for a fresh start
    ;(['seenSelfieTips', 'seenCustomizationIntro'] as IntroSeenKey[]).forEach(key =>
      sessionStorage.removeItem(key)
    )
    setFlags(DEFAULT_FLAGS)
    setIntroFlags(DEFAULT_INTRO_FLAGS)
  }, [])

  const setPendingGeneration = useCallback(
    (value: boolean) => {
      writeFlag('pendingGeneration', value)
      setFlags(refreshFlags())
    },
    [refreshFlags]
  )

  const setOpenStartFlow = useCallback(
    (value: boolean) => {
      writeFlag('openStartFlow', value)
      setFlags(refreshFlags())
    },
    [refreshFlags]
  )

  const setCustomizationStepsMeta = useCallback(
    (meta?: CustomizationStepsMeta | null) => {
      const normalized = meta ?? null
      writeCustomizationMeta(normalized)
      setCustomizationStepsMetaState(normalized)
    },
    []
  )

  const setVisitedSteps = useCallback(
    (steps: number[]) => {
      writeVisitedSteps(steps)
      setVisitedStepsState(steps)
    },
    []
  )

  const markSelfieTipsSeen = useCallback(() => {
    writeIntroFlag('seenSelfieTips', true)
    setIntroFlags(refreshIntroFlags())
  }, [refreshIntroFlags])

  const markCustomizationIntroSeen = useCallback(() => {
    writeIntroFlag('seenCustomizationIntro', true)
    setIntroFlags(refreshIntroFlags())
  }, [refreshIntroFlags])

  // Stable actions object - callbacks don't change between renders
  const actions = useMemo(
    () => ({
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      refreshFlags,
      markSelfieTipsSeen,
      markCustomizationIntroSeen,
      // Convenience aliases for cleaner API
      markSeenSelfieTips: markSelfieTipsSeen,
      markSeenCustomizationIntro: markCustomizationIntroSeen,
      setCustomizationStepsMeta,
      setVisitedSteps
    }),
    [
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      refreshFlags,
      markSelfieTipsSeen,
      markCustomizationIntroSeen,
      setCustomizationStepsMeta,
      setVisitedSteps
    ]
  )

  // Derive computed values (these are cheap to compute, no need to memoize)
  const inFlow = flags.fromGeneration || flags.openStartFlow || flags.pendingGeneration
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
      hasSeenSelfieTips,
      hasSeenCustomizationIntro,
      customizationStepsMeta: resolvedCustomizationMeta,
      visitedSteps
    }),
    [flags, introFlags, hydrated, inFlow, hasSeenSelfieTips, hasSeenCustomizationIntro, resolvedCustomizationMeta, visitedSteps]
  )

  // Combine state and actions - stable reference when neither changes
  return useMemo(
    () => ({ ...state, ...actions }),
    [state, actions]
  )
}

export type UseGenerationFlowStateReturn = ReturnType<typeof useGenerationFlowState>

