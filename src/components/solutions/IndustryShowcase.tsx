'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { SolutionConfig } from '@/config/solutions'

interface ShowcaseProps {
  industry: string
  solution: SolutionConfig
}

interface SamplePhoto {
  id: string
  before: string
  after: string
  alt: string
  attribution?: {
    name: string
    role: string
    team: string
    teamUrl?: string
  }
}

// Default sample photos for before/after comparisons
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1',
    before: '/samples/before-6.jpeg',
    after: '/samples/after-6.png',
    alt: 'Professional headshot transformation example',
    attribution: {
      name: 'David Robles',
      role: 'Senior Executive',
      team: 'Evendo',
      teamUrl: 'https://evendo.com/'
    }
  },
  {
    id: '2',
    before: '/samples/before-4.webp',
    after: '/samples/after-4.webp',
    alt: 'Professional headshot transformation example',
    attribution: {
      name: 'Clarice Pinto',
      role: 'Founder',
      team: 'Pausetiv',
      teamUrl: 'https://www.pausetiv.com'
    }
  },
  {
    id: '3',
    before: '/samples/before-3.webp',
    after: '/samples/after-5.webp',
    alt: 'Professional headshot transformation example',
    attribution: {
      name: 'Matthieu van Haperen',
      role: 'Founder',
      team: 'Teamshotspro',
      teamUrl: 'https://www.teamshotspro.com'
    }
  }
]

export function IndustryShowcase({ industry }: ShowcaseProps) {
  const t = useTranslations(`solutions.${industry}.showcase`)
  const tGallery = useTranslations('gallery')
  const [sliderPositions, setSliderPositions] = useState<Record<string, number>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleSliderChange = (photoId: string, position: number) => {
    setSliderPositions(prev => ({
      ...prev,
      [photoId]: position
    }))
  }

  const onMouseDown = (photoId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingId(photoId)

    const container = e.currentTarget.parentElement as HTMLDivElement
    const rect = container.getBoundingClientRect()

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      handleSliderChange(photoId, percentage)
    }

    const onMouseUp = () => {
      setDraggingId(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onTouchStart = (photoId: string, e: React.TouchEvent) => {
    e.preventDefault()
    setDraggingId(photoId)

    const container = e.currentTarget.parentElement as HTMLDivElement
    const rect = container.getBoundingClientRect()

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const x = e.touches[0].clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      handleSliderChange(photoId, percentage)
    }

    const onTouchEnd = () => {
      setDraggingId(null)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }

    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)
  }

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg sm:text-xl text-text-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_PHOTOS.map((photo, index) => (
            <div
              key={photo.id}
              className={`group relative bg-bg-white rounded-2xl overflow-hidden shadow-depth-lg border border-bg-gray-100 hover:shadow-depth-xl transition-all duration-300 hover:-translate-y-2 ${
                index === 1 ? 'lg:mt-6' : ''
              }`}
            >
              {/* Interactive Before/After Slider */}
              <div className="relative aspect-square bg-bg-gray-50 overflow-hidden cursor-ew-resize">
                {/* Background: After image */}
                <Image
                  src={photo.after}
                  alt={`${photo.alt} - After`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />

                {/* Foreground: Before image clipped to slider position */}
                <div className="absolute inset-0">
                  <Image
                    src={photo.before}
                    alt={`${photo.alt} - Before`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    style={{ clipPath: `inset(0 ${100 - (sliderPositions[photo.id] || 50)}% 0 0)` }}
                  />
                </div>

                {/* Slider handle */}
                <button
                  onMouseDown={(e) => onMouseDown(photo.id, e)}
                  onTouchStart={(e) => onTouchStart(photo.id, e)}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-depth-lg border-2 border-brand-primary/30 flex items-center justify-center text-sm z-20 select-none ${
                    draggingId === photo.id
                      ? 'cursor-ew-resize scale-105'
                      : 'hover:shadow-depth-xl hover:scale-110 transition-all duration-300 active:scale-95'
                  }`}
                  style={{
                    left: `${sliderPositions[photo.id] || 50}%`,
                    transition: draggingId === photo.id ? 'none' : undefined
                  }}
                  aria-label="Drag slider"
                >
                  <span className="text-brand-primary font-bold">⇄</span>
                </button>

                {/* Dynamic Labels */}
                <div className="pointer-events-none z-10">
                  {(sliderPositions[photo.id] || 50) > 50 ? (
                    <div className="absolute top-3 left-3 bg-brand-cta text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                      {tGallery('before')}
                    </div>
                  ) : (
                    <div className="absolute top-3 right-3 bg-brand-secondary text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                      {tGallery('after')}
                    </div>
                  )}
                </div>
              </div>

              {/* Attribution */}
              {photo.attribution && (
                <div className="p-4 bg-bg-white group-hover:bg-bg-gray-50 transition-colors duration-300">
                  <p className="text-sm font-bold text-text-dark">
                    {photo.attribution.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {photo.attribution.role} •{' '}
                    {photo.attribution.teamUrl ? (
                      <a
                        href={photo.attribution.teamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary hover:text-brand-primary-hover underline transition-colors"
                      >
                        {photo.attribution.team}
                      </a>
                    ) : (
                      photo.attribution.team
                    )}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="text-center mt-12">
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center bg-brand-cta text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-brand-cta-hover transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            {tGallery('cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
