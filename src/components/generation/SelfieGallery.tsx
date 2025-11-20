"use client"
import Image from 'next/image'
import { TrashIcon, CameraIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useCallback, useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { LoadingSpinner, SelfieGrid } from '@/components/ui'
import dynamic from 'next/dynamic'
import SelfieApproval from '@/components/Upload/SelfieApproval'
import { promoteUploads } from '@/lib/uploadHelpers'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

export interface GallerySelfieItem {
  id: string
  key: string
  url: string
  uploadedAt?: string
  used?: boolean
}

interface SelfieGalleryProps {
  selfies: GallerySelfieItem[]
  token?: string
  allowDelete?: boolean
  showUploadTile?: boolean
  onUploadClick?: () => void
  onAfterChange?: (selectedIds: string[]) => void
  onDeleted?: (id: string) => void
  // Upload-related props for inline upload functionality
  onSelfiesApproved?: (results: { key: string; selfieId?: string }[]) => void
  onUploadError?: (error: string) => void
}

export default function SelfieGallery({
  selfies,
  token,
  allowDelete = true,
  showUploadTile,
  onUploadClick,
  onAfterChange,
  onDeleted,
  onSelfiesApproved,
  onUploadError,
}: SelfieGalleryProps) {
  const t = useTranslations('selfies.gallery')
  const { selectedSet, toggleSelect } = useSelfieSelection({ token })
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null)

  // Note: useSelfieUpload hook removed - handling uploads directly

  const [multipleUploads, setMultipleUploads] = useState<{ key: string; url?: string }[]>([])
  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false)
  const [isProcessingSingle, setIsProcessingSingle] = useState(false)
  const [forceCamera, setForceCamera] = useState<boolean>(false)
  // Approval screen state for camera captures
  const [pendingApproval, setPendingApproval] = useState<{ key: string; previewUrl?: string } | null>(null)
  // Use ref to track camera captures to avoid closure issues
  const pendingApprovalRef = useRef<{ key: string; previewUrl?: string } | null>(null)


  // Reset forceCamera after a short delay to allow PhotoUpload to use it
  useEffect(() => {
    if (forceCamera) {
      const timer = setTimeout(() => setForceCamera(false), 100)
      return () => clearTimeout(timer)
    }
  }, [forceCamera])

  // Custom upload handler that uses temp storage (required for promotion flow)
  const handlePhotoUpload = async (file: File): Promise<{ key: string; url?: string }> => {
    const isFromCamera = file.name.startsWith('capture-')
    
    setIsProcessingSingle(true)
    try {
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
      // Create preview URL for local display
      const url = URL.createObjectURL(file)
      
      // Store camera captures for approval screen
      if (isFromCamera) {
        const approvalData = { key: data.tempKey, previewUrl: url }
        setPendingApproval(approvalData)
        pendingApprovalRef.current = approvalData
      }
      
      return { key: data.tempKey, url }
    } catch (error) {
      setIsProcessingSingle(false)
      setPendingApproval(null)
      pendingApprovalRef.current = null
      throw error
    }
  }

  // Wrapper for handlePhotoUploaded to store preview URL and handle multiple uploads
  const handlePhotoUploadedWrapper = async (result: { key: string; url?: string } | { key: string; url?: string }[]) => {
    try {
      // Handle multiple uploads - auto-approve and skip approval screen
      if (Array.isArray(result) && result.length > 1) {
        setMultipleUploads(result)
        setIsProcessingMultiple(true)

        // Process all uploads in parallel for better performance
        const successfulResults = await promoteUploads(result)

        // Log results for debugging
        console.log('[SelfieGallery] Promotion results:', successfulResults)

        // Small delay to ensure database is ready
        await new Promise(resolve => setTimeout(resolve, 200))

        setIsProcessingMultiple(false)

        // Call the consolidated callback
        if (onSelfiesApproved && successfulResults.length > 0) {
          console.log('[SelfieGallery] Calling onSelfiesApproved with', successfulResults)
          await onSelfiesApproved(successfulResults)
          console.log('[SelfieGallery] onSelfiesApproved completed')
        }
        return
      } else {
        console.log('Processing single upload:', result)
        // Single upload - check if it's from camera (needs approval) or file (auto-approve)
        const singleResult = result as { key: string; url?: string }
        console.log('Single result:', singleResult)

        // If pending approval exists, it means it's a camera capture - show approval screen
        // Use ref to avoid closure/stale state issues
        if (pendingApprovalRef.current && pendingApprovalRef.current.key === singleResult.key) {
          setIsProcessingSingle(false)
          // Don't auto-approve - wait for user approval
          return
        }

        // File upload - auto-approve directly
        // Promote temp file to permanent storage if it's a temp key
        const [promotedResult] = await promoteUploads([singleResult])
        const finalKey = promotedResult.key
        const selfieId = promotedResult.selfieId

        console.log('Final key:', finalKey, 'selfieId:', selfieId)

        // Call the approval handler directly
        if (onSelfiesApproved) {
          console.log('Calling onSelfiesApproved with:', [{ key: finalKey, selfieId }])
          await onSelfiesApproved([{ key: finalKey, selfieId }])
          console.log('onSelfiesApproved completed')
        }
        
        setIsProcessingSingle(false)
      }
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onUploadError?.('Selfie upload failed. Please try again.')
      setIsProcessingMultiple(false)
      setIsProcessingSingle(false)
      setPendingApproval(null)
      pendingApprovalRef.current = null
    }
  }

  const handleToggle = useCallback(async (id: string, next: boolean) => {
    // toggleSelect is async and calls loadSelected internally
    await toggleSelect(id, next)
    // Notify parent that selection changed - parent will reload from API
    // Use requestAnimationFrame to ensure this happens after React has processed the state update
    if (onAfterChange) {
      requestAnimationFrame(() => {
        onAfterChange([]) // Parent will reload from API
      })
    }
  }, [toggleSelect, onAfterChange])

  const handleDelete = useCallback(async (selfieId: string, key?: string) => {
    try {
      if (token) {
        await fetch(`/api/team/member/selfies/${selfieId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include'
        })
      } else if (key) {
        await fetch(`/api/uploads/delete?key=${encodeURIComponent(key)}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      }
      if (onDeleted) onDeleted(selfieId)
    } catch (e) {
      console.error('Failed to delete selfie', e)
    }
  }, [token, onDeleted])

  // Show approval screen for camera captures
  if (pendingApproval) {
    return (
      <SelfieApproval
        uploadedPhotoKey={pendingApproval.key}
        previewUrl={pendingApproval.previewUrl}
        onApprove={async () => {
          try {
            // Use ref to avoid closure issues - capture current value
            const approvalData = pendingApprovalRef.current
            if (!approvalData) {
              console.error('Approval data not found')
              setPendingApproval(null)
              setIsProcessingSingle(false)
              return
            }

            // Promote temp file to permanent storage
            const [promotedResult] = await promoteUploads([approvalData])
            const finalKey = promotedResult.key
            const selfieId = promotedResult.selfieId

            // Call the approval handler
            if (onSelfiesApproved) {
              await onSelfiesApproved([{ key: finalKey, selfieId }])
            }
            
            // Clear approval state AFTER approval completes
            setPendingApproval(null)
            pendingApprovalRef.current = null
            setIsProcessingSingle(false)
          } catch (error) {
            console.error('Error approving camera capture:', error)
            onUploadError?.('Failed to approve selfie. Please try again.')
            setPendingApproval(null)
            pendingApprovalRef.current = null
            setIsProcessingSingle(false)
          }
        }}
        onRetake={() => {
          // Clear approval state and allow retake
          setPendingApproval(null)
          pendingApprovalRef.current = null
          setIsProcessingSingle(false)
          setForceCamera(true)
        }}
        onCancel={() => {
          // Cancel - delete temp file and reset
          const tempKey = pendingApprovalRef.current?.key
          setPendingApproval(null)
          pendingApprovalRef.current = null
          setIsProcessingSingle(false)
          // Optionally delete the temp file
          if (tempKey && tempKey.startsWith('temp:')) {
            fetch(`/api/uploads/temp?key=${encodeURIComponent(tempKey)}`, {
              method: 'DELETE',
              credentials: 'include'
            }).catch(console.error)
          }
        }}
      />
    )
  }

  return (
    <SelfieGrid>
      {selfies.map((selfie) => {
        const isSelected = selectedSet.has(selfie.id)
        const isLoaded = loadedSet.has(selfie.id)
        return (
          <div key={selfie.id} className={`relative group rounded-lg`}>
            <button
              type="button"
              className={`absolute top-2 left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md border ${isSelected ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-white text-gray-600 border-gray-300'} shadow-sm`}
              aria-pressed={isSelected ? 'true' : 'false'}
              onClick={() => handleToggle(selfie.id, !isSelected)}
            >
              {isSelected ? (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0L4 11.414a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="3" y="3" width="14" height="14" rx="2" ry="2" strokeWidth="2" /></svg>
              )}
            </button>
            <div className={`aspect-square bg-gray-100 rounded-lg overflow-hidden ${isSelected ? 'ring-2 ring-brand-secondary' : ''} relative`}>
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <LoadingSpinner />
                </div>
              )}
              <Image
                src={selfie.url}
                alt="Selfie"
                fill
                className="object-cover"
                unoptimized
                onLoad={() => setLoadedSet(prev => new Set(prev).add(selfie.id))}
                onError={() => setLoadedSet(prev => new Set(prev).add(selfie.id))}
              />
              {selfie.used && hoveredDeleteId === selfie.id && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] leading-tight px-2 py-1 flex items-center gap-1">
                  <InformationCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('deleteDisabledMessage')}</span>
                </div>
              )}
            </div>
            {allowDelete && (
              <div
                className={`absolute top-2 right-2 inline-flex items-center justify-center rounded-full transition-opacity ${selfie.used ? 'bg-gray-300 text-white cursor-not-allowed opacity-70' : 'bg-red-500 text-white opacity-0 group-hover:opacity-100 hover:opacity-100'}`}
                onMouseEnter={selfie.used ? () => setHoveredDeleteId(selfie.id) : undefined}
                onMouseLeave={selfie.used ? () => setHoveredDeleteId((current) => current === selfie.id ? null : current) : undefined}
                onFocusCapture={selfie.used ? () => setHoveredDeleteId(selfie.id) : undefined}
                onBlurCapture={selfie.used ? () => setHoveredDeleteId((current) => current === selfie.id ? null : current) : undefined}
                title={selfie.used ? t('deleteDisabledTooltip') : t('deleteTooltip')}
              >
                <button
                  type="button"
                  onClick={selfie.used ? undefined : () => handleDelete(selfie.id, selfie.key)}
                  disabled={Boolean(selfie.used)}
                  aria-disabled={selfie.used ? 'true' : 'false'}
                  aria-label={selfie.used ? t('deleteDisabledAria') : t('deleteAria')}
                  className="p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}
      {showUploadTile && (
        <div className="aspect-square">
          {onSelfiesApproved ? (
            <PhotoUpload
              multiple
              onUpload={handlePhotoUpload}
              onUploaded={handlePhotoUploadedWrapper}
              testId="gallery-upload-input"
              autoOpenCamera={forceCamera}
              isProcessing={isProcessingMultiple}
            />
          ) : (
            <button
              onClick={onUploadClick}
              className="w-full h-full rounded-2xl bg-gradient-to-br from-white via-gray-50 to-gray-100 border border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-sm text-gray-600 hover:text-brand-primary"
            >
              <CameraIcon className="w-7 h-7 mb-2" />
              <span>Upload/Take new selfie</span>
            </button>
          )}
        </div>
      )}
    </SelfieGrid>
  )
}
