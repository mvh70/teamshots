import { useState } from 'react'
import { useAnalytics } from './useAnalytics'
import { jsonFetcher } from '@/lib/fetcher'

interface UseSelfieUploadOptions {
  onSuccess?: (key: string) => void
  onError?: (error: string) => void
}

export function useSelfieUpload({ onSuccess, onError }: UseSelfieUploadOptions = {}) {
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
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
      
      // Store file locally for later upload
      setPendingFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      
      // Return a temporary key (we'll upload to S3 later on approval)
      const tempKey = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return { key: tempKey, url };
    } catch (error) {
      console.error('File preparation failed:', error);
      track('selfie_upload_failed', {
        error: error instanceof Error ? error.message : 'File preparation failed'
      })
      onError?.(error instanceof Error ? error.message : 'File preparation failed');
      throw error;
    } finally {
      setIsLoading(false);
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
    if (!pendingFile) return;
    
    try {
      setIsLoading(true);
      
      // First upload to S3 with timeout
      const ext = pendingFile.name.split('.')?.pop()?.toLowerCase();
      const uploadPromise = fetch('/api/uploads/proxy', {
        method: 'POST',
        headers: {
          'x-file-content-type': pendingFile.type,
          'x-file-extension': ext || '',
          'x-file-type': 'selfie'
        },
        body: pendingFile,
        credentials: 'include' // Required for Safari to send cookies
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout. Please try again.')), 10000);
      });
      
      const uploadResponse = await Promise.race([uploadPromise, timeoutPromise]) as Response;
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const { key } = await uploadResponse.json();
      
      // Then create database record and do validation
      await jsonFetcher('/api/uploads/create', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ key }),
        credentials: 'include'
      });
      
      // If successful, mark as approved and call success callback
      setIsApproved(true);
      setUploadedKey(key);
      
      // Track successful upload
      track('selfie_upload_success', {
        file_size: pendingFile.size,
        file_type: pendingFile.type
      })
      
      onSuccess?.(key);
    } catch (error) {
      console.error('Approval failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Approval failed';
      
      // Track approval failure
      track('selfie_approval_failed', {
        error: errorMessage
      })
      
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  const handleReject = async () => {
    track('selfie_rejected')
    if (uploadedKey) {
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setIsApproved(false)
  }

  const handleRetake = async () => {
    track('selfie_retake')
    if (uploadedKey) {
      await deleteSelfie(uploadedKey)
    }
    setUploadedKey(null)
    setPendingFile(null)
    setIsApproved(false)
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
