'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface GalleryItem {
  id: string
  beforeImage: string
  afterImage: string
  title: string
  description: string
}

interface WelcomeGalleryProps {
  items?: GalleryItem[]
  className?: string
}

const defaultItems: GalleryItem[] = [
  {
    id: '1',
    beforeImage: '/samples/before-1.jpg', // Placeholder - would be actual before image
    afterImage: '/samples/after-1.png', // Placeholder - would be actual after image
    title: 'Casual selfie to professional headshot',
    description: 'Transform everyday photos into polished professional images'
  },
  {
    id: '2',
    beforeImage: '/samples/before-2.png', // Placeholder
    afterImage: '/samples/after-2.png', // Placeholder
    title: 'Team photo consistency',
    description: 'Ensure your entire team looks cohesive and professional'
  },
  {
    id: '3',
    beforeImage: '/samples/before-hero.png', // Placeholder
    afterImage: '/samples/after-hero.png', // Placeholder
    title: 'Brand-aligned portraits',
    description: 'Create photos that perfectly match your brand identity'
  }
]

export function WelcomeGallery({
  items = defaultItems,
  className = ''
}: WelcomeGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length)
      }, 4000) // Change every 4 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isAutoPlaying, items.length])

  // Pause auto-play on hover/touch
  const handleMouseEnter = () => setIsAutoPlaying(false)
  const handleMouseLeave = () => setIsAutoPlaying(true)

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setIsAutoPlaying(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return

    const distance = touchStartX.current - touchEndX.current
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) {
      // Swipe left - next image
      setCurrentIndex((prev) => (prev + 1) % items.length)
    } else if (isRightSwipe) {
      // Swipe right - previous image
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
    }

    touchStartX.current = null
    touchEndX.current = null
    setIsAutoPlaying(true)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false)
    // Resume auto-play after 5 seconds
    setTimeout(() => setIsAutoPlaying(true), 5000)
  }

  const currentItem = items[currentIndex]

  return (
    <div
      className={`relative w-full max-w-md mx-auto ${className}`}
      id="welcome-section"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main carousel container */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-lg bg-gray-100">
        {/* Before/After images */}
        <div className="relative w-full h-full">
          {/* Before image (background) */}
          <div className="absolute inset-0">
            <Image
              src={currentItem.beforeImage}
              alt="Before transformation"
              fill
              className="object-cover opacity-60"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <div className="text-sm font-medium mb-1">Before</div>
            </div>
          </div>

          {/* After image (overlay) */}
          <div className="absolute inset-0 flex items-center justify-end">
            <div className="w-1/2 h-full relative">
              <Image
                src={currentItem.afterImage}
                alt="After transformation"
                fill
                className="object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-4 right-4 text-white text-right">
                <div className="text-sm font-medium mb-1">After</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <h3 className="text-white font-semibold text-lg mb-2">
            {currentItem.title}
          </h3>
          <p className="text-white/90 text-sm">
            {currentItem.description}
          </p>
        </div>

        {/* Navigation arrows (desktop) */}
        <button
          onClick={() => goToSlide((currentIndex - 1 + items.length) % items.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100"
          aria-label="Previous image"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => goToSlide((currentIndex + 1) % items.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100"
          aria-label="Next image"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center mt-4 space-x-2">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-brand-primary' : 'bg-gray-300'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Mobile swipe hint */}
      <div className="mt-3 text-center md:hidden">
        <p className="text-xs text-gray-500">
          👆 Swipe to see more examples
        </p>
      </div>
    </div>
  )
}
