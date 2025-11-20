import { useState, useCallback } from 'react'
import { jsonFetcher } from '@/lib/fetcher'

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
  selected?: boolean
}

export function useSelfieUploads() {
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUploads = useCallback(async () => {
    // Reset error state
    setError(null)

    try {
      setLoading(true)
      const data = await jsonFetcher<{ items?: UploadListItem[] }>('/api/uploads/list', {
        credentials: 'include'
      })

      // Fetch selected selfie IDs and merge selection state
      const selectedRes = await jsonFetcher<{ selfies: { id: string }[] }>('/api/selfies/selected', {
        credentials: 'include'
      }).catch(() => ({ selfies: [] as { id: string }[] }))

      const selectedSet = new Set((selectedRes.selfies || []).map(s => s.id))
      const items = (data.items || []).map(it => ({ ...it, selected: selectedSet.has(it.id) }))

      setUploads(items)
    } catch (err) {
      console.error('Error loading uploads:', err)
      setUploads([])
      setError('Failed to load uploads')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    uploads,
    loading,
    error,
    loadUploads
  }
}
