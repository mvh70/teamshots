"use client"
import Image from 'next/image'
import { TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useCallback, useState, useRef } from 'react'
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
  saveEndpoint?: (key: string) => Promise<string | undefined> // Custom save function for invite flows
  uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }> // Custom upload function for invite flows
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
  saveEndpoint,
  uploadEndpoint,
}: SelfieGalleryProps) {
  const t = useTranslations('selfies.gallery')
  const { selectedSet, toggleSelect } = useSelfieSelection({ token })
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  // Note: useSelfieUpload hook removed - handling uploads directly

  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false)
  // Approval screen state for camera captures
  const [pendingApproval, setPendingApproval] = useState<{ key: string; previewUrl?: string } | null>(null)
  // Use ref to track camera captures to avoid closure issues
  const pendingApprovalRef = useRef<{ key: string; previewUrl?: string } | null>(null)

  // Use key to force PhotoUpload remount when retaking camera
  const cameraKeyRef = useRef(0)



  // Custom upload handler - uses custom endpoint if provided (invite flow), otherwise temp storage
  const handlePhotoUpload = async (file: File): Promise<{ key: string; url?: string }> => {
    const isFromCamera = file.name.startsWith('capture-')
    try {
      let result: { key: string; url?: string }
      
      // Use custom upload endpoint if provided (invite flow)
      if (uploadEndpoint) {
        result = await uploadEndpoint(file)
      } else {
        // Standard flow: Upload to temp storage
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
        result = { key: data.tempKey, url }
      }
      
      // Store camera captures for approval screen
      if (isFromCamera && result.url) {
        const approvalData = { key: result.key, previewUrl: result.url }
        setPendingApproval(approvalData)
        pendingApprovalRef.current = approvalData
      }
      
      return result
    } catch (error) {
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
        setIsProcessingMultiple(true)

        let successfulResults: { key: string; selfieId?: string }[]

        // Check if saveEndpoint is provided (invite flow with direct uploads)
        if (saveEndpoint) {
          // Invite flow: Process direct uploads by calling saveEndpoint
          successfulResults = await Promise.all(
            result.map(async (upload) => {
              try {
                const selfieId = await saveEndpoint(upload.key)
                return { key: upload.key, selfieId }
              } catch (error) {
                console.error('Failed to save direct upload:', error)
                return { key: upload.key, selfieId: undefined }
              }
            })
          )
        } else {
          // Standard flow: Promote temp uploads to permanent storage
          successfulResults = await promoteUploads(result)
        }

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
          // Don't auto-approve - wait for user approval
          return
        }

        // File upload - auto-approve directly
        let finalKey: string
        let selfieId: string | undefined

        // Check if saveEndpoint is provided (invite flow with direct uploads)
        if (saveEndpoint) {
          // Invite flow: Direct upload - call saveEndpoint to create DB record
          try {
            selfieId = await saveEndpoint(singleResult.key)
            finalKey = singleResult.key
          } catch (error) {
            console.error('Failed to save direct upload:', error)
            throw error
          }
        } else {
          // Standard flow: Promote temp file to permanent storage
          const [promotedResult] = await promoteUploads([singleResult])
          finalKey = promotedResult.key
          selfieId = promotedResult.selfieId
        }

        console.log('Final key:', finalKey, 'selfieId:', selfieId)

        // Call the approval handler directly
        if (onSelfiesApproved) {
          console.log('Calling onSelfiesApproved with:', [{ key: finalKey, selfieId }])
          await onSelfiesApproved([{ key: finalKey, selfieId }])
          console.log('onSelfiesApproved completed')
        }
        
      }
    } catch (error) {
      console.error('Failed to handle upload:', error)
      onUploadError?.('Selfie upload failed. Please try again.')
      setIsProcessingMultiple(false)
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
    // Optimistically remove from UI immediately
    setDeletedIds(prev => new Set(prev).add(selfieId))
    
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
      // Revert optimistic update on error
      setDeletedIds(prev => {
        const next = new Set(prev)
        next.delete(selfieId)
        return next
      })
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
              return
            }

            let finalKey: string
            let selfieId: string | undefined

            // Check if saveEndpoint is provided (invite flow with direct uploads)
            if (saveEndpoint) {
              // Invite flow: Direct upload - call saveEndpoint to create DB record
              try {
                selfieId = await saveEndpoint(approvalData.key)
                finalKey = approvalData.key
              } catch (error) {
                console.error('Failed to save direct upload:', error)
                throw error
              }
            } else {
              // Standard flow: Promote temp file to permanent storage
              const [promotedResult] = await promoteUploads([approvalData])
              finalKey = promotedResult.key
              selfieId = promotedResult.selfieId
            }

            // Call the approval handler
            if (onSelfiesApproved) {
              await onSelfiesApproved([{ key: finalKey, selfieId }])
            }
            
            // Clear approval state AFTER approval completes
            setPendingApproval(null)
            pendingApprovalRef.current = null
          } catch (error) {
            console.error('Error approving camera capture:', error)
            onUploadError?.('Failed to approve selfie. Please try again.')
            setPendingApproval(null)
            pendingApprovalRef.current = null
          }
        }}
        onRetake={() => {
          // Clear approval state and allow retake by forcing remount
          setPendingApproval(null)
          pendingApprovalRef.current = null
          cameraKeyRef.current += 1
        }}
        onCancel={() => {
          // Cancel - delete temp file and reset
          const tempKey = pendingApprovalRef.current?.key
          setPendingApproval(null)
          pendingApprovalRef.current = null
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

  // Filter out deleted selfies optimistically
  const visibleSelfies = selfies.filter(selfie => !deletedIds.has(selfie.id))

  return (
    <SelfieGrid>
      {visibleSelfies.map((selfie) => {
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
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <LoadingSpinner />
                </div>
              )}
              {/* Fill square on all screen sizes */}
              <div className="absolute inset-0">
                <Image
                  src={selfie.url}
                  alt="Selfie"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized
                  onLoad={() => setLoadedSet(prev => new Set(prev).add(selfie.id))}
                  onError={() => setLoadedSet(prev => new Set(prev).add(selfie.id))}
                />
              </div>
              {selfie.used && hoveredDeleteId === selfie.id && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] leading-tight px-2 py-1 flex items-center gap-1">
                  <InformationCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('deleteDisabledMessage')}</span>
                </div>
              )}
            </div>
            {allowDelete && (
              <div
                className={`absolute top-2 right-2 z-20 inline-flex items-center justify-center rounded-full transition-opacity ${
                  selfie.used 
                    ? 'bg-gray-300 text-white cursor-not-allowed opacity-70' 
                    : 'bg-red-500 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 md:hover:opacity-100'
                }`}
                onMouseEnter={selfie.used ? () => setHoveredDeleteId(selfie.id) : undefined}
                onMouseLeave={selfie.used ? () => setHoveredDeleteId((current) => current === selfie.id ? null : current) : undefined}
                onFocusCapture={selfie.used ? () => setHoveredDeleteId(selfie.id) : undefined}
                onBlurCapture={selfie.used ? () => setHoveredDeleteId((current) => current === selfie.id ? null : current) : undefined}
                title={selfie.used ? t('deleteDisabledTooltip') : t('deleteTooltip')}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selfie.used) {
                      handleDelete(selfie.id, selfie.key)
                    }
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                  }}
                  disabled={Boolean(selfie.used)}
                  aria-disabled={selfie.used ? 'true' : 'false'}
                  aria-label={selfie.used ? t('deleteDisabledAria') : t('deleteAria')}
                  className="p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}
      {showUploadTile && (
        <div className="md:aspect-square">
          {onSelfiesApproved ? (
            <PhotoUpload
              key={`camera-${cameraKeyRef.current}`}
              multiple
              onUpload={handlePhotoUpload}
              onUploaded={handlePhotoUploadedWrapper}
              testId="gallery-upload-input"
              autoOpenCamera={cameraKeyRef.current > 0}
              isProcessing={isProcessingMultiple}
            />
          ) : onUploadClick ? (
            <div className="aspect-square rounded-2xl p-3 md:p-6 lg:p-8 flex flex-col items-center justify-center text-center border border-gray-200 bg-gradient-to-br from-white via-gray-50 to-gray-100 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={onUploadClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onUploadClick(); }}
              data-testid="selfie-upload-trigger"
            >
              <div className="w-full flex flex-col items-center gap-3">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Add selfie</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SelfieGrid>
  )
}
