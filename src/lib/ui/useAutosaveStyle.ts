"use client"

import { useEffect, useMemo, useState } from "react"
import { saveStyle } from "@/domain/style/service"
import type { PhotoStyleSettings } from "@/types/photo-style"
import { useAutosave } from "@/lib/ui/useAutosave"

export type AutosaveStatus = "idle" | "saving" | "saved" | "error"

type Scope = "individual" | "pro" | "freePackage"

export function useAutosaveStyle(params: {
  scope: Scope
  packageId: string
  initialContextId?: string | null
  settings: PhotoStyleSettings
  delayMs?: number
  name?: string
}) {
  // Do NOT default initialContextId to null here. We differentiate between
  // undefined (create mode => allow creating a new record) and null (explicitly
  // provided by caller during edit-load => pause until a real id is available).
  const { scope, packageId, initialContextId, settings, delayMs = 600, name } = params
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [contextId, setContextId] = useState<string | null>(initialContextId ?? null)

  // Keep internal contextId in sync only when the caller-provided id changes.
  // This is a controlled component pattern where we need to sync external changes
  // while allowing internal updates (from save callback). Depending on contextId
  // creates a feedback loop with parents that mirror this value.
  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state */
  useEffect(() => {
    if (initialContextId === undefined) return
    // Avoid redundant state updates
    if (initialContextId !== contextId) {
      setContextId(initialContextId)
    }
  // Intentionally exclude `contextId` to avoid feedback loop with parents mirroring this value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContextId])
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */

  const payloadValue = useMemo(() => ({ settings, name: (name ?? '').trim() }), [settings, name])

  useAutosave({
    value: payloadValue,
    delayMs,
    enabled: !(initialContextId === null && contextId === null) && !(initialContextId && !contextId),
    save: async (val) => {
      setStatus("saving")
      const res = await saveStyle({ scope, contextId, packageId, ui: val.settings as PhotoStyleSettings, name: (val.name as string) || undefined })
      if (res?.error) {
        setStatus("error")
        return { ok: false }
      }
      if (res?.contextId) setContextId(res.contextId)
      setStatus("saved")
      return { ok: true }
    }
  })

  return { status, contextId, setContextId } as const
}


