"use client"
import Image from 'next/image'
import { TrashIcon, CameraIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoadingSpinner, SelfieGrid } from '@/components/ui'

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
}

export default function SelfieGallery({
  selfies,
  token,
  allowDelete = true,
  showUploadTile,
  onUploadClick,
  onAfterChange,
  onDeleted,
}: SelfieGalleryProps) {
  const t = useTranslations('selfies.gallery')
  const { selectedSet, toggleSelect } = useSelfieSelection({ token })
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null)

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
                width={400}
                height={400}
                className="w-full h-full object-cover"
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
        <button
          onClick={onUploadClick}
          className="aspect-square bg-white rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-sm text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          <CameraIcon className="w-7 h-7 mb-2" />
          <span>Upload/Take new selfie</span>
        </button>
      )}
    </SelfieGrid>
  )
}
