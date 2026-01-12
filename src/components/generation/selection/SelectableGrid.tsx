'use client'

import React, { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { LoadingSpinner, SelfieGrid } from '@/components/ui'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useUploadFlow } from '@/hooks/useUploadFlow'
import type { UploadResult } from '@/hooks/useUploadFlow'
import dynamic from 'next/dynamic'
import SelfieApproval from '@/components/Upload/SelfieApproval'

const PhotoUpload = dynamic(() => import('@/components/Upload/PhotoUpload'), { ssr: false })

export interface SelectableItem {
  id: string
  key: string
  url: string
  uploadedAt?: string
  /** If true, item cannot be deleted (was used in a generation) */
  used?: boolean
  /** Selfie type classification (front_view, side_view, full_body, unknown) */
  selfieType?: string | null
  /** Confidence score for the selfie type classification (0.0 - 1.0) */
  selfieTypeConfidence?: number | null
  /** Whether the selfie is proper for generation (single person, clear face) */
  isProper?: boolean
  /** Reason why the selfie is not proper */
  improperReason?: string | null
}

type SelectionMode = 
  | { mode: 'managed'; token?: string; onAfterChange?: (selectedIds: string[]) => void }
  | { mode: 'controlled'; selectedIds: Set<string>; onToggle: (id: string, selected: boolean) => void }

interface SelectableGridProps {
  /** Items to display in the grid */
  items: SelectableItem[]
  /** Selection management mode */
  selection: SelectionMode
  /** Allow deleting items (default: false) */
  allowDelete?: boolean
  /** Called after an item is deleted */
  onDeleted?: (id: string) => void
  /** Token for API calls (invite flows) */
  token?: string
  /** Show upload tile at the end of the grid */
  showUploadTile?: boolean
  /** Upload tile click handler (for opening external upload modal) */
  onUploadClick?: () => void
  /** Upload configuration for inline upload in grid */
  upload?: {
    /** Called when selfies are approved */
    onSelfiesApproved: (results: { key: string; selfieId?: string }[]) => void
    /** Called on upload error */
    onError?: (error: string) => void
    /** Custom save endpoint for invite flows */
    saveEndpoint?: (key: string) => Promise<string | undefined>
    /** Custom upload endpoint for invite flows */
    uploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }>
  }
  /** Show loading spinner per image (default: true) */
  showLoadingState?: boolean
  /** Additional CSS classes */
  className?: string
  /** Custom QR tile to show between selfies and upload tile (desktop only) */
  qrTile?: React.ReactNode
}

/**
 * Unified selectable grid component for selfies and other items.
 * 
 * Supports two selection modes:
 * - 'managed': Uses useSelfieSelection hook internally
 * - 'controlled': Selection state passed via props
 * 
 * Features:
 * - Selection checkboxes with visual feedback
 * - Optional delete functionality
 * - Optional inline upload with PhotoUpload/approval flow
 * - Loading states per image
 * - Responsive grid layout
 */
export default function SelectableGrid({
  items,
  selection,
  allowDelete = false,
  onDeleted,
  token,
  showUploadTile = false,
  onUploadClick,
  upload,
  showLoadingState = true,
  className = '',
  qrTile
}: SelectableGridProps) {
  const t = useTranslations('selfies.gallery')
  
  // Internal selection state for managed mode
  const managedSelection = useSelfieSelection({
    token: selection.mode === 'managed' ? selection.token : undefined
  })
  
  // Determine which selection to use
  const selectedSet = selection.mode === 'managed' 
    ? managedSelection.selectedSet 
    : selection.selectedIds
    
  // Loading and delete state
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  // Store pending file for classification
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  
  // Upload flow state
  const cameraKeyRef = useRef(0)
  const {
    pendingApproval,
    isProcessing,
    uploadFile,
    handleUploadResult,
    approvePending,
    cancelPending,
    retakePending
  } = useUploadFlow({
    uploadEndpoint: upload?.uploadEndpoint,
    saveEndpoint: upload?.saveEndpoint,
    onApproved: upload?.onSelfiesApproved,
    onError: upload?.onError
  })

  const handleToggle = useCallback(async (id: string, next: boolean) => {
    if (selection.mode === 'managed') {
      await managedSelection.toggleSelect(id, next)
      if (selection.onAfterChange) {
        requestAnimationFrame(() => {
          selection.onAfterChange?.([])
        })
      }
    } else {
      selection.onToggle(id, next)
    }
  }, [selection, managedSelection])

  const handleDelete = useCallback(async (selfieId: string, key?: string) => {
    // Optimistically remove from UI
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
      onDeleted?.(selfieId)
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

  const handleUploaded = useCallback((result: UploadResult | UploadResult[]) => {
    handleUploadResult(result)
  }, [handleUploadResult])

  // Wrap uploadFile to capture the file for classification
  const handleUploadFile = useCallback(async (file: File) => {
    setPendingFile(file)
    return uploadFile(file)
  }, [uploadFile])

  const handleRetake = useCallback(() => {
    setPendingFile(null)
    retakePending()
    cameraKeyRef.current += 1
  }, [retakePending])

  const handleCancelPending = useCallback(() => {
    setPendingFile(null)
    cancelPending()
  }, [cancelPending])

  // Show approval screen if pending
  if (pendingApproval) {
    return (
      <SelfieApproval
        photoKey={pendingApproval.key}
        previewUrl={pendingApproval.previewUrl}
        imageFile={pendingFile || undefined}
        onApprove={approvePending}
        onRetake={handleRetake}
        onCancel={handleCancelPending}
      />
    )
  }

  // Filter out deleted items
  const visibleItems = items.filter(item => !deletedIds.has(item.id))

  return (
    <SelfieGrid className={className}>
      {visibleItems.map((item) => {
        const isSelected = selectedSet.has(item.id)
        const isLoaded = !showLoadingState || loadedSet.has(item.id)
        // Check if selfie is improper (isProper is explicitly false, not just undefined)
        const isImproper = item.isProper === false

        return (
          <div
            key={item.id}
            className={`relative group rounded-xl transition-all duration-300 ${
              isImproper
                ? 'opacity-60 ring-2 ring-red-300 ring-offset-1'
                : isSelected
                  ? 'ring-2 ring-brand-secondary ring-offset-2 shadow-xl shadow-brand-secondary/30 scale-[1.02]'
                  : 'hover:shadow-xl hover:shadow-gray-300/60 hover:-translate-y-1.5 hover:scale-[1.01]'
            }`}
          >
            {/* Selection checkbox - disabled for improper selfies */}
            <button
              type="button"
              disabled={isImproper}
              className={`absolute top-3 left-3 z-10 inline-flex items-center justify-center w-9 h-9 md:w-8 md:h-8 rounded-lg border-2 transition-all duration-200 ${
                isImproper
                  ? 'bg-red-100 text-red-500 border-red-300 cursor-not-allowed'
                  : isSelected
                    ? 'bg-gradient-to-br from-brand-secondary to-emerald-600 text-white border-brand-secondary shadow-lg scale-110 ring-2 ring-brand-secondary/30'
                    : 'bg-white/95 backdrop-blur-sm text-gray-600 border-gray-300 hover:border-brand-secondary hover:scale-110 hover:bg-white hover:shadow-md'
              } shadow-sm`}
              aria-pressed={isSelected ? 'true' : 'false'}
              aria-label={isImproper ? t('improperAria', { default: 'This selfie cannot be used' }) : isSelected ? t('deselectAria', { default: 'Remove selfie selection' }) : t('selectAria', { default: 'Select selfie' })}
              onClick={() => !isImproper && handleToggle(item.id, !isSelected)}
            >
              {isImproper ? (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" />
                </svg>
              ) : isSelected ? (
                <svg className="w-5 h-5 transition-transform duration-200" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0L4 11.414a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="14" height="14" rx="2" ry="2" />
                </svg>
              )}
            </button>

            {/* Image container */}
            <div
              className={`aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                isSelected
                  ? 'border-brand-secondary shadow-inner ring-1 ring-brand-secondary/20'
                  : 'border-gray-200/50 group-hover:border-gray-300 group-hover:shadow-md'
              } relative`}
            >
              {/* Loading spinner */}
              {!isLoaded && showLoadingState && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 z-10">
                  <LoadingSpinner />
                </div>
              )}
              
              {/* Image */}
              <div className={`absolute inset-0 transition-transform duration-300 ${isSelected ? 'scale-100' : 'group-hover:scale-105'}`}>
                <Image
                  src={item.url}
                  alt="Selfie"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized
                  onLoad={() => setLoadedSet(prev => new Set(prev).add(item.id))}
                  onError={() => setLoadedSet(prev => new Set(prev).add(item.id))}
                />
              </div>
              
              {/* Selection overlay */}
              <div
                className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                  isSelected
                    ? 'bg-brand-secondary/5 ring-1 ring-brand-secondary/10'
                    : 'bg-black/0 group-hover:bg-black/5'
                }`}
              />

              {/* Selfie type badge or analyzing indicator */}
              {item.selfieType && item.selfieType !== 'unknown' && !isImproper ? (
                <div className="absolute bottom-2 left-2 z-10">
                  <SelfieTypeBadgeSmall type={item.selfieType} />
                </div>
              ) : !item.selfieType && !isImproper ? (
                <div className="absolute bottom-2 left-2 z-10">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800/80 text-white text-[10px] font-medium backdrop-blur-sm">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('analyzing', { defaultValue: 'Analyzing...' })}
                  </span>
                </div>
              ) : null}

              {/* Delete disabled message */}
              {item.used && hoveredDeleteId === item.id && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 text-white text-[11px] leading-tight px-3 py-2 flex items-center gap-1.5 backdrop-blur-sm">
                  <InformationCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('deleteDisabledMessage')}</span>
                </div>
              )}

              {/* Improper selfie message - always visible for improper selfies */}
              {isImproper && (
                <div className="absolute inset-x-0 bottom-0 bg-red-600/95 text-white text-[11px] leading-tight px-3 py-2.5 flex items-center gap-1.5 backdrop-blur-sm rounded-b-xl">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium">{item.improperReason || t('improperSelfie', { defaultValue: 'Cannot use this photo' })}</span>
                </div>
              )}
            </div>

            {/* Delete button */}
            {allowDelete && (
              <div
                className={`absolute top-3 right-3 z-20 inline-flex items-center justify-center rounded-full transition-all duration-200 ${
                  item.used
                    ? 'bg-gray-300 text-white cursor-not-allowed opacity-70'
                    : 'bg-red-500 text-white shadow-lg opacity-100 md:group-hover:opacity-100'
                }`}
                onMouseEnter={item.used ? () => setHoveredDeleteId(item.id) : undefined}
                onMouseLeave={item.used ? () => setHoveredDeleteId((current) => current === item.id ? null : current) : undefined}
                title={item.used ? t('deleteDisabledTooltip') : t('deleteTooltip')}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!item.used) {
                      handleDelete(item.id, item.key)
                    }
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={Boolean(item.used)}
                  aria-disabled={item.used ? 'true' : 'false'}
                  aria-label={item.used ? t('deleteDisabledAria') : t('deleteAria')}
                  className="p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 touch-manipulation transition-transform hover:scale-110 active:scale-95"
                  style={{ WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* QR tile (desktop only) - between selfies and upload */}
      {qrTile && (
        <div className="hidden md:block aspect-square">
          {qrTile}
        </div>
      )}

      {/* Upload tile */}
      {showUploadTile && (
        <div className="md:aspect-square">
          {upload ? (
            <PhotoUpload
              key={`camera-${cameraKeyRef.current}`}
              multiple
              onUpload={handleUploadFile}
              onUploaded={handleUploaded}
              testId="gallery-upload-input"
              autoOpenCamera={cameraKeyRef.current > 0}
              isProcessing={isProcessing}
              onCameraError={upload.onError}
            />
          ) : onUploadClick ? (
            <UploadTile onClick={onUploadClick} />
          ) : null}
        </div>
      )}
    </SelfieGrid>
  )
}

/** Upload tile button component */
function UploadTile({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="aspect-square rounded-xl p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-300 bg-gradient-to-br from-brand-primary-light/20 via-white to-gray-50/50 hover:border-brand-primary hover:shadow-xl hover:shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group touch-manipulation relative overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      data-testid="selfie-upload-trigger"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/0 to-indigo-50/0 group-hover:from-brand-primary/5 group-hover:to-indigo-50/20 transition-all duration-300" />
      <div className="relative w-full flex flex-col items-center gap-4 z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary/10 to-indigo-100/50 flex items-center justify-center group-hover:from-brand-primary/20 group-hover:to-indigo-200/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm group-hover:shadow-md">
          <svg className="w-8 h-8 text-brand-primary group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-gray-700 group-hover:text-brand-primary transition-colors duration-200">Add selfie</p>
          <p className="text-xs text-gray-500 group-hover:text-gray-600 transition-colors duration-200">Click to upload</p>
        </div>
      </div>
    </div>
  )
}

/** Small badge showing selfie type classification */
function SelfieTypeBadgeSmall({ type }: { type: string }) {
  const labels: Record<string, string> = {
    front_view: 'Front view',
    side_view: 'Side view',
    partial_body: 'Partial body',
    full_body: 'Full body'
  }

  const colors: Record<string, string> = {
    front_view: 'bg-green-500/90 text-white',
    side_view: 'bg-blue-500/90 text-white',
    partial_body: 'bg-orange-500/90 text-white',
    full_body: 'bg-purple-500/90 text-white'
  }

  const label = labels[type] || type
  const colorClass = colors[type] || 'bg-gray-500/90 text-white'

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shadow-sm backdrop-blur-sm ${colorClass}`}>
      {label}
    </span>
  )
}

