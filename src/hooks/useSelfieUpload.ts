import { useState } from 'react'
import { useAnalytics } from './useAnalytics'
import { jsonFetcher } from '@/lib/fetcher'

interface UseSelfieUploadOptions {
  onSuccess?: (key: string, id?: string) => void
  onError?: (error: string) => void
  saveEndpoint?: (key: string) => Promise<string | undefined> // Custom save function for invite flows, can return selfie ID
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }> // Custom upload function for invite flows or other custom flows
}

export function useSelfieUpload({ onSuccess, onError, saveEndpoint, uploadEndpoint }: UseSelfieUploadOptions = {}) {
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [tempKey, setTempKey] = useState<string | null>(null)
  const [isDirectUpload, setIsDirectUpload] = useState(false) // Track if using direct upload (no temp storage)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null) // Track objectURL for cleanup
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
      
      // Use custom upload endpoint if provided (for invite flows)
      if (uploadEndpoint) {
        const result = await uploadEndpoint(file)
        setPendingFile(file)
        setIsDirectUpload(true) // Mark as direct upload (no temp storage)
        return result
      }
      
      // Standard flow: Upload file to local temp storage
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
      setIsDirectUpload(false) // Mark as temp storage flow
      
      // Revoke previous preview URL to prevent memory leak
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      // Create preview URL for local display
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      
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
      setIsLoading(true)
      
      // If using direct upload (custom endpoint), skip promote step
      if (isDirectUpload) {
        if (!uploadedKey) {
          console.error('handleApprove: No uploadedKey available for direct upload')
          onError?.('No file to approve')
          return
        }
        console.log('handleApprove: Direct upload flow - calling saveEndpoint', { uploadedKey })
        
        // For direct uploads, call saveEndpoint if provided (creates DB record)
        let customSelfieId: string | undefined = undefined
        if (saveEndpoint) {
          try {
            const result = await saveEndpoint(uploadedKey)
            if (typeof result === 'string') {
              customSelfieId = result
            }
            console.log('handleApprove: saveEndpoint completed', { customSelfieId })
          } catch (saveError) {
            console.error('handleApprove: saveEndpoint failed', saveError)
            // Don't throw - the file is already uploaded, this is just DB record creation
          }
        }
        
        setIsApproved(true)
        track('selfie_upload_success', {
          file_size: pendingFile?.size,
          file_type: pendingFile?.type
        })
        console.log('handleApprove: Calling onSuccess callback', { key: uploadedKey, selfieId: customSelfieId })
        onSuccess?.(uploadedKey, customSelfieId)
        setPendingFile(null)
        return
      }
      
      // Standard flow: Promote temp file to S3 and create database record
      if (!tempKey) {
        console.error('handleApprove: No tempKey available')
        onError?.('No file to approve')
        return
      }
      console.log('handleApprove: Starting approval process', { tempKey })
      
      const promoteRes = await fetch('/api/uploads/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempKey }),
        credentials: 'include'
      })
      if (!promoteRes.ok) {
        const d = await promoteRes.json().catch(() => ({}))
        const errorMsg = d.error || 'Promote failed'
        console.error('handleApprove: Promote failed', { status: promoteRes.status, error: errorMsg })
        throw new Error(errorMsg)
      }
      const { key, selfieId } = await promoteRes.json() as { key: string; selfieId?: string }
      console.log('handleApprove: Promote successful', { key, selfieId })
      
      // For custom endpoints, pass the key for additional processing
      let customSelfieId: string | undefined = undefined
      if (saveEndpoint) {
        console.log('handleApprove: Calling saveEndpoint')
        try {
          const result = await saveEndpoint(key)
          // If saveEndpoint returns a selfie ID, use it (for invite flows)
          if (typeof result === 'string') {
            customSelfieId = result
          }
          console.log('handleApprove: saveEndpoint completed', { customSelfieId })
        } catch (saveError) {
          console.error('handleApprove: saveEndpoint failed', saveError)
          // Don't throw - the selfie is already saved, this is just additional processing
        }
      }
      
      // Use custom selfie ID if available (from saveEndpoint), otherwise use the one from promote
      const finalSelfieId = customSelfieId || selfieId
      
      setIsApproved(true)
      setUploadedKey(key)
      track('selfie_upload_success', {
        file_size: pendingFile?.size,
        file_type: pendingFile?.type
      })
      console.log('handleApprove: Calling onSuccess callback', { key, selfieId: finalSelfieId })
      onSuccess?.(key, finalSelfieId)
      console.log('handleApprove: onSuccess callback completed')
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
    if (isDirectUpload && uploadedKey) {
      // Direct upload: delete from S3
      await deleteSelfie(uploadedKey)
    } else if (uploadedKey?.startsWith('temp:') && tempKey) {
      // Temp storage: delete temp file
      await deleteTemp(tempKey)
    } else if (uploadedKey && !uploadedKey.startsWith('temp:')) {
      // Already promoted: delete from S3
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setTempKey(null)
    setIsDirectUpload(false)
    setIsApproved(false)
  }

  const handleRetake = async () => {
    track('selfie_retake')
    if (isDirectUpload && uploadedKey) {
      // Direct upload: delete from S3
      await deleteSelfie(uploadedKey)
    } else if (uploadedKey?.startsWith('temp:') && tempKey) {
      // Temp storage: delete temp file
      await deleteTemp(tempKey)
    } else if (uploadedKey && !uploadedKey.startsWith('temp:')) {
      // Already promoted: delete from S3
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setTempKey(null)
    setIsDirectUpload(false)
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setUploadedKey(null)
    setIsApproved(false)
    setIsLoading(false)
    setPendingFile(null)
    setTempKey(null)
    setIsDirectUpload(false)
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
