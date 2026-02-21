import { useEffect, useState } from 'react'

export function usePersistedStringSet(storageKey: string) {
  const [value, setValue] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setLoaded(false)

    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) {
        setValue(new Set())
        setLoaded(true)
        return
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setValue(new Set())
        setLoaded(true)
        return
      }

      const keys = parsed.filter((entry): entry is string => typeof entry === 'string')
      setValue(new Set(keys))
    } catch {
      setValue(new Set())
    } finally {
      setLoaded(true)
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
