"use client"
import Image from 'next/image'
import { TrashIcon, CameraIcon } from '@heroicons/react/24/outline'
import { useSelfieSelection } from '@/hooks/useSelfieSelection'
import { useCallback, useState } from 'react'

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
  const { selectedSet, toggleSelect, selectedIds } = useSelfieSelection({ token })
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set())

  const handleToggle = useCallback(async (id: string, next: boolean) => {
    await toggleSelect(id, next)
    if (onAfterChange) onAfterChange(Array.from(selectedIds))
  }, [toggleSelect, onAfterChange, selectedIds])

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
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-brand-primary" />
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
            </div>
            {allowDelete && (
              <button
                onClick={selfie.used ? undefined : () => handleDelete(selfie.id, selfie.key)}
                disabled={Boolean(selfie.used)}
                aria-disabled={selfie.used ? 'true' : 'false'}
                title={selfie.used ? 'This selfie is used in a generation and cannot be deleted' : 'Delete selfie'}
                className={`absolute top-2 right-2 p-1 rounded-full transition-opacity ${selfie.used ? 'bg-gray-300 text-white cursor-not-allowed opacity-70' : 'bg-red-500 text-white opacity-0 group-hover:opacity-100'}`}
                aria-label={selfie.used ? 'Delete disabled - used in a generation' : 'Delete selfie'}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
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
    </div>
  )
}
