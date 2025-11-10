import { useCallback, useEffect, useMemo, useState } from 'react'

interface UseSelfieSelectionOptions {
  token?: string
}

export function useSelfieSelection({ token }: UseSelfieSelectionOptions) {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<boolean>(false)
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
    } catch {
      setError('Failed to load selected selfies')
      setSelectedSet(new Set())
    } finally {
      setLoading(false)
    }
  }, [token])

  const toggleSelect = useCallback(async (selfieId: string, nextSelected: boolean) => {
    // optimistic update
    setSelectedSet(prev => {
      const n = new Set(prev)
      if (nextSelected) n.add(selfieId); else n.delete(selfieId)
      return n
    })
    try {
      const qs = token ? `?token=${encodeURIComponent(token)}` : ''
      await fetch(`/api/selfies/${selfieId}/select${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: nextSelected, token }),
        credentials: 'include'
      })
      // re-sync from server to ensure persistence
      await loadSelected()
    } catch {
      // revert on failure
      setSelectedSet(prev => {
        const n = new Set(prev)
        if (nextSelected) n.delete(selfieId); else n.add(selfieId)
        return n
      })
    }
  }, [token, loadSelected])

  useEffect(() => { void loadSelected() }, [loadSelected])

  return { selectedSet, selectedIds, loading, error, loadSelected, toggleSelect, setSelectedSet }
}

export default useSelfieSelection


