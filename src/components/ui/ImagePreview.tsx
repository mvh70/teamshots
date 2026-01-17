'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { LoadingSpinner } from './LoadingSpinner'

interface ImagePreviewProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  variant?: 'thumbnail' | 'preview' | 'full'
  priority?: boolean
  unoptimized?: boolean
  onLoad?: () => void
  onError?: () => void
  'data-testid'?: string
  showLoadingSpinner?: boolean
  showErrorState?: boolean
  errorMessage?: string
}

const variantClasses = {
  thumbnail: 'w-16 h-16',
  preview: 'w-full max-w-sm h-auto',
  full: 'w-full h-full'
}

export function ImagePreview({
  src,
  alt,
  width = 300,
  height = 300,
  className = '',
  variant = 'preview',
  priority = false,
  unoptimized = true,
  onLoad,
  onError,
  'data-testid': testId = 'image-preview',
  showLoadingSpinner = true,
  showErrorState = true,
  errorMessage = 'Failed to load image'
}: ImagePreviewProps) {
  // Track displayed src (what's currently visible) vs pending src (what's loading)
  const [displayedSrc, setDisplayedSrc] = useState(src)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasError, setHasError] = useState(false)

  // When src changes, keep displaying old image until new one loads
  const isPendingNewImage = src !== displayedSrc

  const handleLoad = () => {
    setDisplayedSrc(src)
    setIsInitialLoad(false)
    setHasError(false)
    onLoad?.()
  }

  const handleError = () => {
    setDisplayedSrc(src) // Still update to new src to avoid infinite loading
    setIsInitialLoad(false)
    setHasError(true)
    onError?.()
  }

  const baseClasses = `${variantClasses[variant]} rounded-lg border border-gray-200 shadow-sm ${className}`

  if (hasError && showErrorState && !isPendingNewImage) {
    return (
      <div
        className={`${baseClasses} bg-gray-100 flex items-center justify-center`}
        data-testid={testId}
      >
        <div className="text-center">
          <svg
            className="w-8 h-8 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-xs text-gray-500">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" data-testid={testId}>
      {/* Only show loading spinner on initial load, not when switching images */}
      {isInitialLoad && showLoadingSpinner && (
        <div className={`absolute inset-0 ${baseClasses} bg-gray-100 flex items-center justify-center z-10`}>
          <LoadingSpinner size="md" />
        </div>
      )}
      {/* Current displayed image - always visible */}
      {!isInitialLoad && displayedSrc !== src && (
        <Image
          src={displayedSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${baseClasses} absolute inset-0`}
          priority={priority}
          unoptimized={unoptimized}
        />
      )}
      {/* New/current image - loads in background then becomes visible */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${baseClasses} ${showLoadingSpinner && isInitialLoad ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        priority={priority}
        unoptimized={unoptimized}
        onLoad={handleLoad}
        onError={handleError}
        data-testid="image-element"
      />
    </div>
  )
}

// Specialized image preview components for common use cases
export function ThumbnailImage({
  src,
  alt,
  ...props
}: Omit<ImagePreviewProps, 'variant'>) {
  return <ImagePreview src={src} alt={alt} variant="thumbnail" {...props} />
}

export function PreviewImage({
  src,
  alt,
  ...props
}: Omit<ImagePreviewProps, 'variant'>) {
  return <ImagePreview src={src} alt={alt} variant="preview" {...props} />
}

export function FullImage({
  src,
  alt,
  ...props
}: Omit<ImagePreviewProps, 'variant'>) {
  return <ImagePreview src={src} alt={alt} variant="full" {...props} />
}

// Image preview with overlay for actions (like delete buttons)
export function InteractiveImagePreview({
  children,
  ...props
}: ImagePreviewProps & { children?: React.ReactNode }) {
  return (
    <div className="relative group">
      <ImagePreview {...props} />
      {children && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
