'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ShieldCheckIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import type { SolutionConfig } from '@/config/solutions'

interface HeroProps {
  industry: string
  solution: SolutionConfig
  locale: string
}

export function IndustryHero({ industry, solution, locale }: HeroProps) {
  const t = useTranslations(`solutions.${industry}.hero`)
  const tGallery = useTranslations('gallery')
  const tTrust = useTranslations('landing.teamshotspro.hero.trustBadges')

  // Before/after slider state
  const [isInteracting, setIsInteracting] = useState(false)
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)

    const container = e.currentTarget.parentElement as HTMLDivElement
    const rect = container.getBoundingClientRect()

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      setSliderPosition(percentage)
    }

    const onMouseUp = () => {
      setIsDragging(false)
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

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const container = e.currentTarget.parentElement as HTMLDivElement
    const rect = container.getBoundingClientRect()

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const x = e.touches[0].clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      setSliderPosition(percentage)
    }

    const onTouchEnd = () => {
      setIsDragging(false)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }

    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)
  }

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-bg-gray-100 bg-bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-primary-hover/5 pointer-events-none" />

          {/* FORCE-REBUILD-MARKER */}
          <div className="grid gap-8 lg:gap-10 lg:grid-cols-2 p-6 sm:p-8 lg:p-10 relative items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary mb-4">
            <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
            {t('badge')}
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-text-dark leading-[1.05]">
            {t('title')}
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-text-body leading-relaxed max-w-2xl">
            {t('subtitle')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex justify-center items-center rounded-xl bg-brand-cta px-6 py-4 text-white font-semibold hover:bg-brand-cta-hover transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {t('cta')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex justify-center items-center rounded-xl border border-bg-gray-100 bg-bg-white px-6 py-4 text-text-dark font-semibold hover:border-brand-primary/40 hover:shadow-sm transition-all"
            >
              {locale === 'es' ? 'Ver precios' : 'See pricing'}
            </Link>
          </div>

          {/* Social Proof Stack */}
          <div className="mt-6 flex items-center gap-4">
            {/* User Avatars */}
            <div className="flex -space-x-2">
              <Image src="/images/avatars/avatar-1.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-2.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-3.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
              <Image src="/images/avatars/avatar-4.jpeg" alt="User" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-300" />

            {/* Rating */}
            <div className="flex items-center gap-1.5">
              <div className="flex text-yellow-400 text-sm">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span className="font-bold text-text-dark">4.9</span>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ShieldCheckIcon className="w-4 h-4 text-green-600" />
              <span className="font-medium">{tTrust('stripeSecure')}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ClockIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('instantResults')}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <BanknotesIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('noSubscription')}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <ShieldCheckIcon className="w-4 h-4 text-brand-primary" />
              <span className="font-medium">{tTrust('moneyBack')}</span>
            </div>
          </div>
        </div>

        {/* Before/After Slider */}
        <div className="relative">
          <div
            className="relative rounded-2xl overflow-hidden shadow-depth-xl bg-gray-100 border border-bg-gray-100"
            onMouseEnter={() => setIsInteracting(true)}
            onTouchStart={() => setIsInteracting(true)}
          >
            <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden cursor-ew-resize">
              {/* Background: After image */}
              <Image
                src={solution.heroImage}
                alt={`${tGallery('after')} - AI transformation`}
                fill
                className="object-cover"
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
              />

              {/* Foreground: Before image clipped to slider position */}
              <div className="absolute inset-0">
                <Image
                  src={solution.beforeImage}
                  alt={`${tGallery('before')} - AI transformation`}
                  fill
                  className="object-cover"
                  priority
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                />
              </div>

              {/* Slider handle */}
              <button
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white shadow-depth-xl border-2 border-brand-primary/30 flex items-center justify-center text-lg z-20 select-none ${
                  isDragging
                    ? 'cursor-ew-resize scale-105'
                    : 'hover:shadow-depth-2xl hover:scale-110 transition-all duration-300 active:scale-95'
                }`}
                style={{ left: `${sliderPosition}%`, transition: isDragging ? 'none' : undefined }}
                aria-label="Drag slider"
              >
                <span className="text-brand-primary font-bold">⇄</span>
              </button>
            </div>

            {/* Interactive Hint */}
            {!isInteracting && (
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-5 transition-all duration-500 pointer-events-none z-10">
                <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-white/95 backdrop-blur-sm text-gray-900 px-5 py-2.5 rounded-full shadow-depth-xl border border-gray-200/50 flex items-center gap-2 animate-pulse">
                    <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <span className="text-sm font-semibold">{tGallery('dragToCompare')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Labels */}
            <div className="pointer-events-none z-10">
              {sliderPosition > 50 ? (
                <div className="absolute top-4 left-4 bg-brand-cta text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30">
                  {tGallery('before')}
                </div>
              ) : (
                <div className="absolute top-4 right-4 bg-brand-secondary text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30">
                  {tGallery('after')}
                </div>
              )}
            </div>

            {/* Stats Badge */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-xl shadow-depth-xl border border-gray-200/50">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold">{tGallery('generatedIn')}</span>
              </div>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>
    </section>
  )
}
