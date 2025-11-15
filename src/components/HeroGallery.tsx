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
      {/* Interactive Before/After Slider with Enhanced Styling */}
      <div 
        className="relative rounded-3xl overflow-hidden shadow-depth-2xl bg-gray-100 border-2 border-white/50 hover:shadow-floating transition-all duration-500"
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

          {/* Slider handle with Enhanced Styling */}
          <button
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white shadow-depth-xl border-3 border-brand-primary/30 flex items-center justify-center text-lg hover:shadow-depth-2xl hover:scale-110 transition-all duration-300 active:scale-95 z-20"
            style={{ left: `${sliderPosition}%` }}
            aria-label="Drag slider"
          >
            <span className="text-brand-primary font-bold">⇄</span>
          </button>
        </div>

        {/* Interactive Hint - Shows on first load */}
        {!isInteracting && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-5 transition-all duration-500 pointer-events-none z-10">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-white/95 backdrop-blur-sm text-gray-900 px-6 py-3 rounded-full shadow-depth-xl border border-gray-200/50 flex items-center gap-2 animate-pulse">
                <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-sm font-semibold">{t('dragToCompare')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Labels based on slider position (right = Before, left = After) */}
        <div className="pointer-events-none z-10">
          {sliderPosition > 50 ? (
            <div className="absolute top-5 left-5 bg-brand-cta text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30">
              {t('before')}
            </div>
          ) : (
            <div className="absolute top-5 right-5 bg-brand-secondary text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30">
              {t('after')}
            </div>
          )}
        </div>

        {/* Stats Badge with Enhanced Styling */}
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm text-gray-900 px-5 py-2.5 rounded-xl shadow-depth-xl border border-gray-200/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-bold">{t('generatedIn')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

