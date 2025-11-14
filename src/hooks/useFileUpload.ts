'use client'

import { useState, useCallback, useMemo } from 'react'

export type UploadType = 'selfie' | 'background' | 'logo'

export interface FileUploadOptions {
  uploadType: UploadType
  maxFileSize?: number // in MB, default 25
  allowedTypes?: string[]
  onSuccess?: (key: string, data?: unknown) => void
  onError?: (error: string) => void
  saveEndpoint?: (key: string) => Promise<void>
  tempStorage?: boolean // whether to use temp storage first
  autoPromote?: boolean // automatically promote from temp to permanent
}

export interface FileUploadResult {
  key?: string
  url?: string
  tempKey?: string
}

const DEFAULT_OPTIONS: Partial<FileUploadOptions> = {
  maxFileSize: 25,
  tempStorage: true,
  autoPromote: false
}

const TYPE_CONFIGS = {
  selfie: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
    folder: 'selfies'
  },
  background: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
    folder: 'backgrounds'
  },
  logo: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml'],
    folder: 'logos'
  }
}

export function useFileUpload(options: FileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const config = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options])
  const typeConfig = useMemo(() => TYPE_CONFIGS[config.uploadType], [config.uploadType])

  const validateFile = useCallback((file: File): string | null => {
    // Size validation
    const maxSizeBytes = (config.maxFileSize || 25) * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File too large (max ${config.maxFileSize}MB)`
    }

    // Type validation
    const allowedTypes = config.allowedTypes || typeConfig.allowedTypes
    if (!allowedTypes.includes(file.type)) {
      const extensions = allowedTypes.map(type => type.split('/')[1]).join(', ')
      return `Invalid file type. Only ${extensions} allowed.`
    }

    return null
  }, [config, typeConfig])

  const uploadToTemp = useCallback(async (file: File): Promise<FileUploadResult> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/uploads/temp', {
      method: 'POST',
      headers: {
        'x-file-content-type': file.type,
        'x-file-extension': ext,
        'x-file-type': config.uploadType
      },
      body: formData,
      credentials: 'include'
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Temp upload failed')
    }

    const data = await res.json()
    return { tempKey: data.tempKey, url: URL.createObjectURL(file) }
  }, [config.uploadType])

  const uploadDirect = useCallback(async (file: File): Promise<FileUploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', typeConfig.folder)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Upload failed')
    }

    const data = await res.json()
    return {
      key: data.key,
      url: `/api/files/get?key=${encodeURIComponent(data.key)}`
    }
  }, [typeConfig.folder])

  const promoteFromTemp = useCallback(async (tempKey: string): Promise<FileUploadResult> => {
    const res = await fetch('/api/uploads/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempKey }),
      credentials: 'include'
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Promotion failed')
    }

    const { key } = await res.json()
    return {
      key,
      url: `/api/files/get?key=${encodeURIComponent(key)}`,
      tempKey
    }
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<FileUploadResult> => {
    setIsUploading(true)
    setError(null)
    setProgress(0)

    try {
      // Validate file
      const validationError = validateFile(file)
      if (validationError) {
        throw new Error(validationError)
      }

      setProgress(25)

      let result: FileUploadResult

      if (config.tempStorage) {
        // Upload to temp storage first
        result = await uploadToTemp(file)
        setProgress(75)

        if (config.autoPromote && result.tempKey) {
          // Auto-promote to permanent storage
          result = await promoteFromTemp(result.tempKey)
        }
      } else {
        // Direct upload
        result = await uploadDirect(file)
      }

      setProgress(100)

      // Call success callback
      if (config.onSuccess && result.key) {
        await config.onSuccess(result.key, result)
      }

      // Call save endpoint if provided
      if (config.saveEndpoint && result.key) {
        await config.saveEndpoint(result.key)
      }

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      config.onError?.(errorMessage)
      throw err
    } finally {
      setIsUploading(false)
    }
  }, [config, validateFile, uploadToTemp, uploadDirect, promoteFromTemp])

  const promoteFile = useCallback(async (tempKey: string): Promise<FileUploadResult> => {
    setIsUploading(true)
    setError(null)

    try {
      const result = await promoteFromTemp(tempKey)

      if (config.onSuccess && result.key) {
        await config.onSuccess(result.key, result)
      }

      if (config.saveEndpoint && result.key) {
        await config.saveEndpoint(result.key)
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Promotion failed'
      setError(errorMessage)
      config.onError?.(errorMessage)
      throw err
    } finally {
      setIsUploading(false)
    }
  }, [config, promoteFromTemp])

  return {
    uploadFile,
    promoteFile,
    isUploading,
    progress,
    error,
    clearError: () => setError(null)
  }
}
