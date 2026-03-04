import { useEffect, useRef, useState } from 'react'

export function usePersistedStringSet(storageKey: string) {
  const [value, setValue] = useState<Set<string>>(new Set())
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const previousKeyRef = useRef(storageKey)
  const loaded = loadedKey === storageKey

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isKeyChange = previousKeyRef.current !== storageKey
    previousKeyRef.current = storageKey

    let loadedKeys: string[] = []
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          loadedKeys = parsed.filter((entry): entry is string => typeof entry === 'string')
        }
      }
    } catch {
      loadedKeys = []
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      // Merge storage snapshot with in-memory updates for the same key.
      // This avoids dropping step visits that happen before hydration finishes.
      setValue((prev) => {
        const next = new Set<string>()
        if (!isKeyChange) {
          prev.forEach((entry) => next.add(entry))
        }
        loadedKeys.forEach((entry) => next.add(entry))
        return next
      })
      setLoadedKey(storageKey)
    })

    return () => {
      cancelled = true
    }
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!loaded) return

    const keys = Array.from(value)
    if (keys.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(keys))
    } else {
      sessionStorage.removeItem(storageKey)
    }
  }, [value, storageKey, loaded])

  return { value, setValue, loaded }
}
