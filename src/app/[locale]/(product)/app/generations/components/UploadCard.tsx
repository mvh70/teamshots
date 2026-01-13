'use client'

import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Image from 'next/image'

export type UploadListItem = {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  usedInGenerationId?: string
  hasGenerations?: boolean // New field to indicate if selfie has any generations
  selected?: boolean // Selection state
}

interface UploadCardProps {
  item: UploadListItem
  onDelete?: (id: string) => void
  onToggleSelect?: (id: string, selected: boolean) => void
  hideGenerateCta?: boolean
}

const MAX_IMAGE_RETRY_ATTEMPTS = 2

const buildImageUrl = (key: string, retryVersion: number) => {
  const params = new URLSearchParams({ key })
  if (retryVersion > 0) {
    params.set('retry', retryVersion.toString())
  }
  return `/api/files/get?${params.toString()}`
}

// Separate component for image with retry logic - uses key prop for reset
function UploadImage({ 
  uploadedKey, 
  onError 
}: { 
  uploadedKey: string
  onError: () => void 
}) {
  const [imageError, setImageError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const imgSrc = !imageError
    ? buildImageUrl(uploadedKey, retryCount)
    : '/placeholder-image.png'

  return (
    <Image
      src={imgSrc}
      alt="upload"
      width={300}
      height={300}
      className="w-full h-full object-cover"
      unoptimized
      onError={() => {
        if (retryCount < MAX_IMAGE_RETRY_ATTEMPTS) {
          setRetryCount(prev => prev + 1)
          return
        }
        setImageError(true)
        onError()
      }}
      onLoadingComplete={() => {
        if (retryCount !== 0) {
          setRetryCount(0)
        }
      }}
    />
  )
}

export default function UploadCard({ item, onDelete, onToggleSelect, hideGenerateCta = false }: UploadCardProps) {
  const t = useTranslations('generations')
  const [isDeleting, setIsDeleting] = useState(false)
  const normalizedKey = item.uploadedKey && item.uploadedKey !== 'undefined' ? item.uploadedKey : null

  const handleDelete = async () => {
    if (!onDelete) return
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this selfie? This action cannot be undone.')) {
      return
    }
    
    setIsDeleting(true)
    try {
      // Let the parent component handle the API call
      await onDelete(item.id)
    } catch (error) {
      console.error('Error deleting selfie:', error)
      alert('Failed to delete selfie. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggle = () => {
    if (onToggleSelect) {
      onToggleSelect(item.id, !Boolean(item.selected))
    }
  }

  return (
    <div className={`rounded-lg border overflow-hidden bg-white ${item.selected ? 'border-brand-secondary' : 'border-gray-200'}`}>
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <button
          type="button"
          className={`absolute top-2 left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md border ${item.selected ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-white text-gray-600 border-gray-300'} shadow-sm`}
          aria-pressed={item.selected ? 'true' : 'false'}
          onClick={handleToggle}
        >
          {item.selected ? (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0L4 11.414a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="3" y="3" width="14" height="14" rx="2" ry="2" strokeWidth="2" /></svg>
          )}
        </button>
        {normalizedKey ? (
          <UploadImage 
            key={normalizedKey} // Key-based reset: when key changes, component resets
            uploadedKey={normalizedKey}
            onError={() => console.warn('Image failed to load, may not be migrated to Backblaze yet:', item.uploadedKey)}
          />
        ) : (
          <Image
            src="/placeholder-image.png"
            alt="upload"
            width={300}
            height={300}
            className="w-full h-full object-cover"
            unoptimized
          />
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 relative">
            {!hideGenerateCta && (
            <Link 
              href={`/app/generate/start?key=${encodeURIComponent(item.uploadedKey)}`} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-cta border border-brand-cta rounded-md hover:bg-brand-cta-hover hover:border-brand-cta-hover transition-colors"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z" 
                />
              </svg>
              {t('actions.generate')}
            </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            {item.hasGenerations && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {t('labels.usedInGeneration')}
              </span>
            )}
            {!item.hasGenerations && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="relative group text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 transition-colors"
              >
                {isDeleting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                  </div>
                ) : (
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                )}
                {/* Popover tooltip */}
                <div className="absolute bottom-full left-0 transform -translate-x-2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {isDeleting ? t('actions.deleting') : t('actions.delete')}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


