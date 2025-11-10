import { useState } from 'react'
import { useAnalytics } from './useAnalytics'
import { jsonFetcher } from '@/lib/fetcher'

interface UseSelfieUploadOptions {
  onSuccess?: (key: string, id?: string) => void
  onError?: (error: string) => void
  saveEndpoint?: (key: string) => Promise<void> // Custom save function for invite flows
}

export function useSelfieUpload({ onSuccess, onError, saveEndpoint }: UseSelfieUploadOptions = {}) {
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [tempKey, setTempKey] = useState<string | null>(null)
  const { track } = useAnalytics()

  const handlePhotoUpload = async (file: File): Promise<{ key: string; url?: string }> => {
    try {
      setIsLoading(true)
      
      // Track photo upload attempt
      track('selfie_upload_started', {
        file_size: file.size,
        file_type: file.type,
        file_name: file.name
      })
      
      // Upload file to local temp storage immediately
      const ext = file.name.split('.')?.pop()?.toLowerCase()
      const res = await fetch('/api/uploads/temp', {
        method: 'POST',
        headers: {
          'x-file-content-type': file.type,
          'x-file-extension': ext || ''
        },
        body: file,
        credentials: 'include'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Temp upload failed')
      }
      const data = await res.json() as { tempKey: string }
      setTempKey(data.tempKey)
      setPendingFile(file)
      
      // Create preview URL for local display
      const url = URL.createObjectURL(file)
      
      // Return temp key as the current uploadedKey surrogate
      return { key: data.tempKey, url }
    } catch (error) {
      console.error('File preparation failed:', error)
      track('selfie_upload_failed', {
        error: error instanceof Error ? error.message : 'File preparation failed'
      })
      onError?.(error instanceof Error ? error.message : 'File preparation failed')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoUploaded = async (result: { key: string; url?: string }) => {
    try {
      if (!result.key || result.key === 'undefined') {
        console.error('handlePhotoUploaded received invalid key:', result.key)
        onError?.('Invalid upload key received')
        return
      }
      setUploadedKey(result.key)
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onError?.('Selfie upload failed. Please try again.')
    }
  }

  const handleApprove = async () => {
    try {
      if (!tempKey) return
      setIsLoading(true)
      
      // Promote temp file to S3 and create database record
      const promoteRes = await fetch('/api/uploads/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempKey }),
        credentials: 'include'
      })
      if (!promoteRes.ok) {
        const d = await promoteRes.json().catch(() => ({}))
        throw new Error(d.error || 'Promote failed')
      }
      const { key, selfieId } = await promoteRes.json() as { key: string; selfieId?: string }
      
      // For custom endpoints, pass the key for additional processing
      if (saveEndpoint) {
        await saveEndpoint(key)
      }
      
      setIsApproved(true)
      setUploadedKey(key)
      track('selfie_upload_success', {
        file_size: pendingFile?.size,
        file_type: pendingFile?.type
      })
      onSuccess?.(key, selfieId)
      // Clear temp key now that we have final key
      setTempKey(null)
      setPendingFile(null)
    } catch (error) {
      console.error('Approval failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Approval failed'
      track('selfie_approval_failed', { error: errorMessage })
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    track('selfie_rejected')
    if (uploadedKey?.startsWith('temp:') && tempKey) {
      await deleteTemp(tempKey)
    } else if (uploadedKey && !uploadedKey.startsWith('temp:')) {
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setTempKey(null)
    setIsApproved(false)
  }

  const handleRetake = async () => {
    track('selfie_retake')
    if (uploadedKey?.startsWith('temp:') && tempKey) {
      await deleteTemp(tempKey)
    } else if (uploadedKey && !uploadedKey.startsWith('temp:')) {
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setTempKey(null)
    setIsApproved(false)
  }

  const deleteTemp = async (key: string) => {
    try {
      await fetch(`/api/uploads/temp?key=${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'include' })
    } catch (error) {
      console.error('Error deleting temp selfie:', error)
    }
  }

  const deleteSelfie = async (key: string) => {
    if (!key || key === 'undefined') {
      console.error('deleteSelfie called with invalid key:', key)
      return
    }
    try {
      await jsonFetcher(`/api/uploads/delete?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Error deleting selfie:', error)
    }
  }

  const reset = () => {
    setUploadedKey(null)
    setIsApproved(false)
    setIsLoading(false)
    setPendingFile(null)
    setTempKey(null)
  }

  return {
    uploadedKey,
    isApproved,
    isLoading,
    handlePhotoUpload,
    handlePhotoUploaded,
    handleApprove,
    handleReject,
    handleRetake,
    deleteSelfie,
    reset
  }
}
