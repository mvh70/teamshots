'use client'

import { useState } from 'react'
import GenerationCard, { type GenerationListItem } from '@/app/[locale]/(product)/app/generations/components/GenerationCard'

interface GenerationsViewProps {
  generations: GenerationListItem[]
  currentUserId?: string
  token?: string
  /** Optional: custom empty state component */
  emptyState?: React.ReactNode
}

/**
 * Shared component for displaying generations in a compact grid with lightbox support.
 * Used by both normal user generations and invite-dashboard generations pages.
 */
export function GenerationsView({ 
  generations, 
  currentUserId, 
  token,
  emptyState 
}: GenerationsViewProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  if (generations.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <>
      {/* Compact image grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {generations.map((generation) => (
          <GenerationCard
            key={generation.id}
            item={generation}
            currentUserId={currentUserId}
            token={token}
            onImageClick={(src) => setLightboxImage(src)}
          />
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            {/* Close button */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Image */}
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage}
                alt="Photo preview"
                className="w-full h-auto max-h-[85vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Standalone Lightbox component for custom usage.
 */
export function Lightbox({ 
  src, 
  alt = 'Photo preview',
  label,
  onClose 
}: { 
  src: string
  alt?: string
  /** Optional label shown in top-left corner */
  label?: string
  onClose: () => void 
}) {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Optional label */}
        {label && (
          <p className="absolute -top-12 left-0 text-white text-lg font-medium">
            {label}
          </p>
        )}
        {/* Image */}
        <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  )
}
