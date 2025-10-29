'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface SamplePhoto {
  id: string;
  before: string;
  after: string;
  alt: string;
}

// Featured hero example - using local transformation images
const HERO_PHOTO: SamplePhoto = {
  id: 'hero-1',
  before: '/samples/before-hero.png',
  after: '/samples/after-hero.png',
  alt: 'Professional headshot transformation - AI powered'
};

export default function HeroGallery() {
  const t = useTranslations('gallery');
  const [isInteracting, setIsInteracting] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);

  const onMouseDown = (e: React.MouseEvent) => {
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onMouseMove = (e: MouseEvent) => {
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    };

    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Interactive Before/After Slider */}
      <div 
        className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-100"
        onMouseEnter={() => setIsInteracting(true)}
        onTouchStart={() => setIsInteracting(true)}
      >
        <div 
          className="relative aspect-square bg-gray-100 overflow-hidden cursor-ew-resize"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            setSliderPosition(percentage);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            setSliderPosition(percentage);
          }}
        >
          {/* Background: After image (now on background to make left = Before) */}
          <Image
            src={HERO_PHOTO.after}
            alt={`${t('after')} - AI transformation`}
            fill
            className="object-cover"
            unoptimized
          />
          
          {/* Foreground: Before image clipped to slider position */}
          <div className="absolute inset-0">
            <Image
              src={HERO_PHOTO.before}
              alt={`${t('before')} - AI transformation`}
              fill
              className="object-cover"
              unoptimized
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            />
          </div>

          {/* Slider handle */}
          <button
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white shadow-xl border-2 border-gray-300 flex items-center justify-center text-sm hover:shadow-2xl transition-shadow"
            style={{ left: `${sliderPosition}%` }}
            aria-label="Drag slider"
          >
            ⇆
          </button>
        </div>

        {/* Interactive Hint - Shows on first load */}
        {!isInteracting && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-5 transition-all duration-300 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-white text-gray-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-sm font-medium">{t('dragToCompare')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Labels based on slider position (right = Before, left = After) */}
        <div className="pointer-events-none">
          {sliderPosition > 50 ? (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
              {t('before')}
            </div>
          ) : (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
              {t('after')}
            </div>
          )}
        </div>

        {/* Stats Badge */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-gray-900 px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-semibold">{t('generatedIn')}</span>
          </div>
        </div>
      </div>

      {/* Trust Indicator */}
      <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{t('noWatermarks')}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{t('highResolution')}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{t('commercialUse')}</span>
        </div>
      </div>
    </div>
  );
}

