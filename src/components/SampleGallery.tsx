'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { getBrandName } from '@/config/brand';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Grid } from '@/components/ui';

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

// Sample data - using local transformation images (WebP for performance)
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1', 
    before: '/samples/before-2.webp',
    after: '/samples/after-2.webp',
    alt: 'Professional headshot transformation example 2',
    attribution: {
      name: 'Sarah Johnson',
      role: 'Marketing',
      team: 'Digital Agency'
    }
  },
  {
    id: '2',
    before: '/samples/before-1.webp',
    after: '/samples/after-1.webp',
    alt: 'Professional headshot transformation example 1',
    attribution: {
      name: 'Matthieu van Haperen',
      role: 'Entrepreneur',
      team: 'Carpe Diem Ventures'
    }
  },
  {
    id: '3',
    before: '/samples/before-3.webp',
    after: '/samples/after-3.webp',
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
  const { track } = useAnalytics();
  const [sliderPositions, setSliderPositions] = useState<Record<string, number>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
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
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(photoId);
    
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      handleSliderChange(photoId, percentage);
    };

    const onMouseUp = () => {
      setDraggingId(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onTouchStart = (photoId: string, e: React.TouchEvent) => {
    e.preventDefault();
    setDraggingId(photoId);
    
    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      handleSliderChange(photoId, percentage);
    };

    const onTouchEnd = () => {
      setDraggingId(null);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };

  return (
    <>
      <section className="py-20 sm:py-24 lg:py-32 bg-bg-gray-50 relative grain-texture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
              {t('title')}
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <Grid
            ref={galleryRef}
            cols={{ mobile: 1, tablet: 2, desktop: 3 }}
            gap="lg"
          >
            {SAMPLE_PHOTOS.map((photo, index) => (
              <div
                key={photo.id}
                className="gallery-image"
              >
                <div 
                  className={`group relative bg-bg-gray-50 rounded-3xl overflow-hidden shadow-depth-lg border-2 border-brand-primary-lighter/20 hover:shadow-depth-2xl hover:border-brand-primary-lighter/50 transition-all duration-500 hover:-translate-y-3 ${
                    index === 1 ? 'lg:mt-8' : '' // Stagger middle item on desktop
                  }`}
                >
                  {/* Interactive Before/After Slider */}
                  <div 
                    className="relative aspect-square bg-bg-gray-50 overflow-hidden cursor-ew-resize"
                  >
                    {/* Background: After image (now background so left = Before) */}
                    <Image
                      src={photo.after}
                      alt={`${photo.alt} - After`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                    />
                    
                    {/* Foreground: Before image clipped to slider position */}
                    <div className="absolute inset-0">
                      <Image
                        src={photo.before}
                        alt={`${photo.alt} - Before`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        loading="lazy"
                        style={{ clipPath: `inset(0 ${100 - (sliderPositions[photo.id] || 50)}% 0 0)` }}
                      />
                    </div>

                    {/* Slider handle */}
                    <button
                      onMouseDown={(e) => onMouseDown(photo.id, e)}
                      onTouchStart={(e) => onTouchStart(photo.id, e)}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-bg-white shadow-depth-lg border-2 border-brand-primary/30 flex items-center justify-center text-sm z-20 select-none ${
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

                    {/* Dynamic Labels based on slider position (right = Before, left = After) */}
                    <div className="pointer-events-none z-10">
                      {(sliderPositions[photo.id] || 50) > 50 ? (
                        <div className="absolute top-4 left-4 bg-brand-cta text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                          {t('before')}
                        </div>
                      ) : (
                        <div className="absolute top-4 right-4 bg-brand-secondary text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                          {t('after')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attribution with Enhanced Styling */}
                  {photo.attribution && (
                    <div className="p-5 bg-bg-white group-hover:bg-bg-gray-50 transition-colors duration-300">
                      <p className="text-base font-bold text-text-dark font-display">
                        {photo.attribution.name}
                      </p>
                      <p className="text-sm text-text-body mt-1">
                        {photo.attribution.role} • {photo.attribution.team}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Grid>

          {/* CTA Button with Enhanced Styling */}
          <div className="text-center mt-16">
            <Link
              href="/auth/signup"
              onClick={() =>
                track('cta_clicked', {
                  placement: 'sample_gallery',
                  action: 'signup',
                })
              }
              className="inline-flex items-center justify-center bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white px-12 py-6 rounded-2xl font-bold text-lg lg:text-xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
            >
              {tHero('getStarted')}
            </Link>
            {/* Subtext reinforcing free offer below CTA */}
            <div className="mt-4">
              <p className="text-sm text-text-body">
                {tHero('freeCtaSubtext')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
