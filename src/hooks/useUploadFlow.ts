import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { promoteUploads } from '@/lib/uploadHelpers'

type UploadSource = 'camera' | 'ios-camera' | 'file'

export interface UploadMetadata {
  source?: UploadSource
  /** Optional preview/object URL created by the caller */
  objectUrl?: string
}

export interface UploadResult {
  key: string
  url?: string
  source?: UploadSource
}

export interface UseUploadFlowOptions {
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }>
  saveEndpoint?: (key: string) => Promise<string | undefined>
  onApproved?: (results: { key: string; selfieId?: string }[]) => Promise<void> | void
  onError?: (message: string) => void
}

type FlowState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'pendingApproval'; pending: PendingApproval }
  | { status: 'processing' }

interface PendingApproval {
  key: string
  previewUrl?: string
  source: UploadSource
}

type FlowAction =
  | { type: 'UPLOAD_START' }
  | { type: 'PENDING_APPROVAL'; payload: PendingApproval }
  | { type: 'PROCESSING' }
  | { type: 'RESET' }

function reducer(_: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'UPLOAD_START':
      return { status: 'uploading' }
    case 'PENDING_APPROVAL':
      return { status: 'pendingApproval', pending: action.payload }
    case 'PROCESSING':
      return { status: 'processing' }
    case 'RESET':
    default:
      return { status: 'idle' }
  }
}

const CAMERA_FILE_PREFIX = 'capture-'

async function defaultTempUpload(file: File): Promise<{ key: string; url?: string }> {
  const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
  const res = await fetch('/api/uploads/temp', {
    method: 'POST',
    headers: {
      'x-file-content-type': file.type,
      'x-file-extension': ext
    },
    body: file,
    credentials: 'include'
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Temp upload failed')
  }

  const data = (await res.json()) as { tempKey: string }
  const url = URL.createObjectURL(file)
  return { key: data.tempKey, url }
}

function detectSource(meta?: UploadMetadata, file?: File): UploadSource {
  if (meta?.source) return meta.source
  if (file && file.name.startsWith(CAMERA_FILE_PREFIX)) return 'camera'
  return 'file'
}

export function useUploadFlow({
  uploadEndpoint = defaultTempUpload,
  saveEndpoint,
  onApproved,
  onError
}: UseUploadFlowOptions = {}) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' } as FlowState)
  const pendingApprovalRef = useRef<PendingApproval | null>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())

  const registerObjectUrl = useCallback((url?: string) => {
    if (!url) return
    objectUrlsRef.current.add(url)
  }, [])

  const revokeObjectUrl = useCallback((url?: string) => {
    if (!url) return
    URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(url)
  }, [])

  const revokeAllUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  const persistUploads = useCallback(
    async (uploads: UploadResult[]): Promise<{ key: string; selfieId?: string }[]> => {
      if (!uploads.length) return []

      if (saveEndpoint) {
        const results = await Promise.all(
          uploads.map(async upload => {
            try {
              const selfieId = await saveEndpoint(upload.key)
              return { key: upload.key, selfieId }
            } catch (error) {
              console.error('Failed to save direct upload:', error)
              return { key: upload.key, selfieId: undefined }
            }
          })
        )
        return results
      }

      return promoteUploads(uploads)
    },
    [saveEndpoint]
  )

  const uploadFile = useCallback(
    async (file: File, meta?: UploadMetadata): Promise<UploadResult> => {
      try {
        dispatch({ type: 'UPLOAD_START' })
        const result = await uploadEndpoint(file)
        const source = detectSource(meta, file)
        if (source !== 'file' && !result.url && meta?.objectUrl) {
          result.url = meta.objectUrl
        }
        if (result.url) {
          registerObjectUrl(result.url)
        }
        return { ...result, source }
      } catch (error) {
        dispatch({ type: 'RESET' })
        const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.'
        onError?.(errorMessage)
        // Return empty result instead of throwing to avoid double error handling
        return { key: '', source: detectSource(meta, file) }
      }
    },
    [uploadEndpoint, onError, registerObjectUrl]
  )

  const approveUploads = useCallback(
    async (uploads: UploadResult[]) => {
      try {
        dispatch({ type: 'PROCESSING' })
        const successfulResults = await persistUploads(uploads)
        await onApproved?.(successfulResults)
        dispatch({ type: 'RESET' })
      } catch (error) {
        dispatch({ type: 'RESET' })
        onError?.('Selfie upload failed. Please try again.')
        console.error('Failed to handle upload:', error)
      }
    },
    [persistUploads, onApproved, onError]
  )

  const handleUploadResult = useCallback(
    async (result: UploadResult | UploadResult[]) => {
      const uploads = Array.isArray(result) ? result : [result]
      const single = uploads.length === 1 ? uploads[0] : null

      if (
        single &&
        (single.source === 'camera' || single.source === 'ios-camera') &&
        single.url
      ) {
        const pending: PendingApproval = {
          key: single.key,
          previewUrl: single.url,
          source: single.source
        }
        pendingApprovalRef.current = pending
        dispatch({ type: 'PENDING_APPROVAL', payload: pending })
        return
      }

      await approveUploads(uploads)
    },
    [approveUploads]
  )

  const approvePending = useCallback(async () => {
    if (!pendingApprovalRef.current) return
    const pending = pendingApprovalRef.current
    await approveUploads([{ key: pending.key }])
    pendingApprovalRef.current = null
  }, [approveUploads])

  const cancelPending = useCallback(() => {
    const pending = pendingApprovalRef.current
    if (pending?.previewUrl) {
      URL.revokeObjectURL(pending.previewUrl)
      objectUrlsRef.current.delete(pending.previewUrl)
    }
    pendingApprovalRef.current = null
    dispatch({ type: 'RESET' })
  }, [])

  const retakePending = useCallback(() => {
    cancelPending()
  }, [cancelPending])

  const isProcessing = useMemo(() => state.status === 'processing' || state.status === 'uploading', [state.status])

  return {
    state: state.status,
    pendingApproval: state.status === 'pendingApproval' ? state.pending : null,
    isProcessing,
    uploadFile,
    handleUploadResult,
    approvePending,
    cancelPending,
    retakePending
  }
}

export type UseUploadFlowReturn = ReturnType<typeof useUploadFlow>

