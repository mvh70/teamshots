'use client'

import Image from 'next/image'
import { CameraIcon } from '@heroicons/react/24/outline'
import { SelfieGrid } from '@/components/ui'

export interface GridSelfieItem {
  id: string
  key: string
  url: string
}

interface SelfieSelectionGridProps {
  selfies: GridSelfieItem[]
  selectedSet: Set<string>
  onToggle: (id: string, next: boolean) => void
  showUploadTile?: boolean
  onUploadClick?: () => void
}

export default function SelfieSelectionGrid({
  selfies,
  selectedSet,
  onToggle,
  showUploadTile,
  onUploadClick,
}: SelfieSelectionGridProps) {
  return (
    <SelfieGrid>
      {selfies.map((selfie) => {
        const isSelected = selectedSet.has(selfie.id)
        return (
          <div key={selfie.id} className={`relative group rounded-lg`}>
            <button
              type="button"
              className={`absolute top-2 left-2 z-10 inline-flex items-center justify-center w-11 h-11 md:w-8 md:h-8 rounded-lg border-2 ${
                isSelected
                  ? 'bg-brand-secondary text-white border-brand-secondary'
                  : 'bg-white text-gray-600 border-gray-300'
              } shadow-sm transition-all`}
              aria-pressed={isSelected ? 'true' : 'false'}
              onClick={() => onToggle(selfie.id, !isSelected)}
            >
              {isSelected ? (
                <svg className="w-7 h-7 md:w-5 md:h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0L4 11.414a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-7 h-7 md:w-5 md:h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="14" height="14" rx="2" ry="2" strokeWidth="2" />
                </svg>
              )}
            </button>
            <div className={`aspect-square bg-gray-100 rounded-lg overflow-hidden transition-all relative ${
              isSelected ? 'ring-4 ring-brand-secondary ring-offset-2' : ''
            }`}>
              <Image
                src={selfie.url}
                alt="Selfie"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        )
      })}
      {showUploadTile && (
        <button
          onClick={onUploadClick}
          className="aspect-square bg-white rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-sm text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
          <CameraIcon className="w-7 h-7 mb-2" />
          <span>Upload new selfie</span>
        </button>
      )}
    </SelfieGrid>
  )
}


