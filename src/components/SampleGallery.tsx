'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { getBrandName } from '@/config/brand';

interface SamplePhoto {
  id: string;
  before: string;
  after: string;
  alt: string;
  attribution?: {
    name: string;
    role: string;
    team: string;
  };
}

// Sample data - using local transformation images
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1', 
    before: '/samples/before-2.png',
    after: '/samples/after-2.png',
    alt: 'Professional headshot transformation example 2',
    attribution: {
      name: 'Sarah Johnson',
      role: 'Marketing',
      team: 'Digital Agency'
    }
  },
  {
    id: '2',
    before: '/samples/before-1.jpg',
    after: '/samples/after-1.png',
    alt: 'Professional headshot transformation example 1',
    attribution: {
      name: 'Matthieu van Haperen',
      role: 'Entrepreneur',
      team: 'Carpe Diem Ventures'
    }
  },
  {
    id: '3',
    before: '/samples/before-3.jpg',
    after: '/samples/after-3.png',
    alt: 'Professional headshot transformation example 3',
    attribution: {
      name: 'Matthieu van Haperen',
      role: 'Founder',
                      team: getBrandName()
    }
  }
];

export default function SampleGallery() {
  const t = useTranslations('gallery');
  const tHero = useTranslations('hero');
  const [sliderPositions, setSliderPositions] = useState<Record<string, number>>({});
  const galleryRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    const images = galleryRef.current?.querySelectorAll('.gallery-image');
    images?.forEach((img) => observer.observe(img));

    return () => observer.disconnect();
  }, []);

  const handleSliderChange = (photoId: string, position: number) => {
    setSliderPositions(prev => ({
      ...prev,
      [photoId]: position
    }));
  };

  const onMouseDown = (photoId: string, e: React.MouseEvent) => {
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onMouseMove = (e: MouseEvent) => {
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      handleSliderChange(photoId, percentage);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onTouchStart = (photoId: string, e: React.TouchEvent) => {
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      handleSliderChange(photoId, percentage);
    };

    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };

  return (
    <>
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('subtitle')}
            </p>
          </div>

          <div 
            ref={galleryRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {SAMPLE_PHOTOS.map((photo) => (
              <div
                key={photo.id}
                className="gallery-image"
              >
                <div 
                  className="relative bg-gray-100 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  {/* Interactive Before/After Slider */}
                  <div 
                    className="relative aspect-square bg-gray-100 overflow-hidden cursor-ew-resize"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      handleSliderChange(photo.id, percentage);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.touches[0].clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      handleSliderChange(photo.id, percentage);
                    }}
                  >
                    {/* Background: After image (now background so left = Before) */}
                    <Image
                      src={photo.after}
                      alt={`${photo.alt} - After`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    
                    {/* Foreground: Before image clipped to slider position */}
                    <div className="absolute inset-0">
                      <Image
                        src={photo.before}
                        alt={`${photo.alt} - Before`}
                        fill
                        className="object-cover"
                        unoptimized
                        style={{ clipPath: `inset(0 ${100 - (sliderPositions[photo.id] || 50)}% 0 0)` }}
                      />
                    </div>

                    {/* Slider handle */}
                    <button
                      onMouseDown={(e) => onMouseDown(photo.id, e)}
                      onTouchStart={(e) => onTouchStart(photo.id, e)}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-gray-300 flex items-center justify-center text-xs hover:shadow-xl transition-shadow"
                      style={{ left: `${sliderPositions[photo.id] || 50}%` }}
                      aria-label="Drag slider"
                    >
                      ⇆
                    </button>

                    {/* Dynamic Labels based on slider position (right = Before, left = After) */}
                    <div className="pointer-events-none">
                      {(sliderPositions[photo.id] || 50) > 50 ? (
                        <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                          {t('before')}
                        </div>
                      ) : (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                          {t('after')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attribution */}
                  {photo.attribution && (
                    <div className="p-4 bg-white">
                      <p className="text-sm font-semibold text-gray-900">
                        {photo.attribution.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {photo.attribution.role} • {photo.attribution.team}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <Link
              href="/auth/signup"
              className="bg-brand-cta text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-cta-hover transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {tHero('getStarted')}
            </Link>
            {/* Subtext reinforcing free offer below CTA */}
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {tHero('freeCtaSubtext')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
