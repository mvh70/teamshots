import { useState, useCallback, useEffect, useRef } from 'react'
import { jsonFetcher } from '@/lib/fetcher'

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  personCount?: number | null
  isProper?: boolean | null
  improperReason?: string | null
}

// Poll interval when selfies are being analyzed (2 seconds)
const ANALYZING_POLL_INTERVAL = 2000

export function useSelfieUploads() {
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadUploads = useCallback(async (silent = false) => {
    // Reset error state
    setError(null)

    try {
      if (!silent) setLoading(true)
      const url = `/api/uploads/list?t=${Date.now()}`
      const data = await jsonFetcher<{ items?: UploadListItem[] }>(url, {
        credentials: 'include',
        cache: 'no-store'
      })

      // Just return the raw uploads - selection state is managed separately
      const items = data.items || []
      // Debug: log classification status for each item
      console.log('[useSelfieUploads] Fetched items:', items.map(i => ({
        id: i.id.slice(-6),
        selfieType: i.selfieType,
        isProper: i.isProper,
        improperReason: i.improperReason?.slice(0, 30)
      })))
      setUploads(items)
    } catch (err) {
      console.error('Error loading uploads:', err)
      setUploads([])
      setError('Failed to load uploads')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Auto-poll when there are selfies being analyzed (selfieType === null)
  useEffect(() => {
    const analyzingItems = uploads.filter(u => u.selfieType === null || u.selfieType === undefined)
    const hasAnalyzing = analyzingItems.length > 0

    console.log('[useSelfieUploads] Polling check:', {
      hasAnalyzing,
      analyzingCount: analyzingItems.length,
      analyzingIds: analyzingItems.map(i => i.id.slice(-6))
    })

    if (hasAnalyzing) {
      // Start polling if not already
      if (!pollIntervalRef.current) {
        console.log('[useSelfieUploads] Starting poll interval')
        pollIntervalRef.current = setInterval(() => {
          loadUploads(true) // Silent refresh
        }, ANALYZING_POLL_INTERVAL)
      }
    } else {
      // Stop polling when no more analyzing
      if (pollIntervalRef.current) {
        console.log('[useSelfieUploads] Stopping poll interval')
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [uploads, loadUploads])

  return {
    uploads,
    loading,
    error,
    loadUploads
  }
}
