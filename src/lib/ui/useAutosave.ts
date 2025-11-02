"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type AutosaveStatus = "idle" | "saving" | "saved" | "error"

interface UseAutosaveParams<T> {
  value: T
  save: (value: T) => Promise<{ ok: boolean } | void>
  delayMs?: number
  enabled?: boolean
}

export function useAutosave<T>({ value, save, delayMs = 600, enabled = true }: UseAutosaveParams<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerializedRef = useRef<string>("")

  const payload = useMemo(() => JSON.stringify(value), [value])

  useEffect(() => {
    if (!enabled) return

    if (payload === lastSerializedRef.current && status !== "error") {
      return
    }

    if (timer.current) clearTimeout(timer.current)
    setStatus("saving")
    timer.current = setTimeout(async () => {
      try {
        const res = await save(value)
        const ok = typeof res === 'object' && res !== null ? (res as { ok?: boolean }).ok !== false : true
        if (!ok) {
          setStatus("error")
          return
        }
        lastSerializedRef.current = payload
        setStatus("saved")
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500)
      } catch {
        setStatus("error")
      }
    }, delayMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, enabled])

  return { status } as const
}


