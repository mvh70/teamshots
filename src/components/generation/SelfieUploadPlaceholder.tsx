'use client'

import { PlusIcon, PhotoIcon } from '@heroicons/react/24/outline'

interface SelfieUploadPlaceholderProps {
  onUploadClick: () => void
  onCameraClick?: () => void
  disabled?: boolean
}

/**
 * Reusable placeholder component for uploading/taking selfies
 * Shows two buttons: "Use Camera" and "Choose from Gallery"
 * Used consistently across individual/team-admin and invite dashboard flows
 */
export default function SelfieUploadPlaceholder({
  onUploadClick,
  onCameraClick,
  disabled = false
}: SelfieUploadPlaceholderProps) {
  // If no separate camera handler provided, both buttons use the same handler
  const handleCameraClick = onCameraClick || onUploadClick
  
  return (
    <div
      className="aspect-square rounded-2xl p-3 md:p-6 lg:p-8 flex flex-col items-center justify-center text-center border border-gray-200 bg-gradient-to-br from-white via-gray-50 to-gray-100 hover:shadow-lg transition-all duration-200"
      data-testid="selfie-upload-placeholder"
    >
      <div className="w-full flex flex-col items-center">
        {/* Plus icon */}
        <div className="mb-2 flex items-center justify-center">
          <PlusIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-400" />
        </div>
        
        {/* Buttons - vertically stacked */}
        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation()
              handleCameraClick()
            }}
            disabled={disabled}
            aria-label="Open camera to take a photo"
            data-testid="camera-button"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Use Camera</span>
          </button>
          
          <button
            type="button"
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation()
              onUploadClick()
            }}
            disabled={disabled}
            aria-label="Choose a file from your device"
            data-testid="file-picker-button"
          >
            <PhotoIcon className="w-5 h-5 flex-shrink-0" />
            <span>Choose from Gallery</span>
          </button>
        </div>
      </div>
    </div>
  )
}

