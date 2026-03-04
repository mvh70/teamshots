import { useCallback, useEffect, useMemo, useState } from 'react'

interface UseSelfieSelectionOptions {
  token?: string
  enabled?: boolean
  /**
   * Optional error callback invoked when selection operations fail.
   * If not provided, errors are stored in the returned error state.
   */
  onError?: (error: string) => void
}

export function useSelfieSelection({ token, enabled = true, onError }: UseSelfieSelectionOptions) {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<boolean>(false)
  const [hasLoaded, setHasLoaded] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(() => Array.from(selectedSet), [selectedSet])

  const loadSelected = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const qsToken = token ? `token=${encodeURIComponent(token)}&` : ''
      const res = await fetch(`/api/selfies/selected?${qsToken}t=${Date.now()}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) {
        setSelectedSet(new Set())
        return
      }
      const data = (await res.json()) as { selfies?: { id: string }[] }
      setSelectedSet(new Set((data.selfies || []).map(s => s.id)))
    } catch (err) {
      const errorMessage = 'Failed to load selected selfies'
      console.error('[useSelfieSelection] loadSelected failed', err)
      setError(errorMessage)
      setSelectedSet(new Set())
      onError?.(errorMessage)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [token, onError])

  const toggleSelect = useCallback(async (selfieId: string, nextSelected: boolean) => {
    // optimistic update
    setSelectedSet(prev => {
      const n = new Set(prev)
      if (nextSelected) n.add(selfieId); else n.delete(selfieId)
      return n
    })
    try {
      const qs = token ? `?token=${encodeURIComponent(token)}` : ''
      const response = await fetch(`/api/selfies/${selfieId}/select${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: nextSelected, token }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to toggle selection')
      }
      // Re-sync after each mutation to prevent stale selected-set races when users tap quickly.
      await loadSelected()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle selection'
      onError?.(errorMessage)
      // revert on failure
      setSelectedSet(prev => {
        const n = new Set(prev)
        if (nextSelected) n.delete(selfieId); else n.add(selfieId)
        return n
      })
    }
  }, [token, onError, loadSelected])

  // Load selected selfies on mount
  useEffect(() => {
    if (!enabled) {
      setHasLoaded(true)
      return
    }
    void loadSelected()
  }, [enabled, loadSelected])

  return { selectedSet, selectedIds, loading, hasLoaded, error, loadSelected, toggleSelect, setSelectedSet }
}

export default useSelfieSelection
