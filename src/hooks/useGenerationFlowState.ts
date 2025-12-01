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

function writeVisitedSteps(steps: number[]): void {
  if (typeof window === 'undefined') return
  if (steps.length > 0) {
    sessionStorage.setItem(VISITED_STEPS_KEY, JSON.stringify(steps))
  } else {
    sessionStorage.removeItem(VISITED_STEPS_KEY)
  }
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

export function useGenerationFlowState() {
  const [flags, setFlags] = useState<GenerationFlowFlags>(DEFAULT_FLAGS)
  const [introFlags, setIntroFlags] = useState<IntroSeenFlags>(DEFAULT_INTRO_FLAGS)
  const [hydrated, setHydrated] = useState(false)
  const [customizationStepsMeta, setCustomizationStepsMetaState] = useState<CustomizationStepsMeta | null>(null)
  const [visitedSteps, setVisitedStepsState] = useState<number[]>([])

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

  const inFlow = flags.fromGeneration || flags.openStartFlow || flags.pendingGeneration

  // Convenience getters for intro flags
  const hasSeenSelfieTips = introFlags.seenSelfieTips
  const hasSeenCustomizationIntro = introFlags.seenCustomizationIntro

  return useMemo(
    () => ({
      flags,
      introFlags,
      hydrated,
      inFlow,
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      refreshFlags,
      // Original naming
      markSelfieTipsSeen,
      markCustomizationIntroSeen,
      // Convenience aliases for cleaner API
      markSeenSelfieTips: markSelfieTipsSeen,
      markSeenCustomizationIntro: markCustomizationIntroSeen,
      hasSeenSelfieTips,
      hasSeenCustomizationIntro,
      customizationStepsMeta: customizationStepsMeta ?? DEFAULT_CUSTOMIZATION_STEPS_META,
      setCustomizationStepsMeta,
      visitedSteps,
      setVisitedSteps
    }),
    [
      flags,
      introFlags,
      hydrated,
      inFlow,
      markInFlow,
      clearFlow,
      resetFlow,
      setPendingGeneration,
      setOpenStartFlow,
      refreshFlags,
      markSelfieTipsSeen,
      markCustomizationIntroSeen,
      hasSeenSelfieTips,
      hasSeenCustomizationIntro,
      customizationStepsMeta,
      setCustomizationStepsMeta,
      visitedSteps,
      setVisitedSteps
    ]
  )
}

export type UseGenerationFlowStateReturn = ReturnType<typeof useGenerationFlowState>

