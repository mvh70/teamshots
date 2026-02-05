'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { BRAND_CONFIG } from '@/config/brand';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Grid } from '@/components/ui';
import type { LandingVariant } from '@/config/landing-content';

interface SamplePhoto {
  id: string;
  before: string;
  after: string;
  alt: string;
  attribution?: {
    name: string;
    role: string;
    team: string;
    teamUrl?: string;
    linkedinUrl?: string;
  };
}

// Sample data - using local transformation images (WebP for performance)
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1',
    before: '/samples/before-6.jpeg',
    after: '/samples/after-6.png',
    alt: 'Professional headshot transformation example 2',
    attribution: {
      name: 'David Robles',
      role: 'Senior Executive',
      team: 'Evendo',
      teamUrl: 'https://evendo.com/',
      linkedinUrl: 'https://www.linkedin.com/in/roblesfosg/'
    }
  },
  {
    id: '2',
    before: '/samples/before-4.webp',
    after: '/samples/after-4.webp',
    alt: 'Professional headshot transformation example 4',
    attribution: {
      name: 'Clarice Pinto',
      role: 'Founder',
      team: 'Pausetiv',
      teamUrl: 'https://www.pausetiv.com',
      linkedinUrl: 'https://www.linkedin.com/in/clarice-pinto-39578/'
    }
  },
  {
    id: '3',
    before: '/samples/before-5.webp',
    after: '/samples/after-5.webp',
    alt: 'Professional headshot transformation example 3',
    attribution: {
      name: 'Mathieu Van Haperen',
      role: 'Founder',
      team: 'TeamShotsPro',
      teamUrl: 'https://teamshotspro.com',
      linkedinUrl: 'https://www.linkedin.com/in/matthieuvanhaperen/'
    }
  }
];

interface SampleGalleryProps {
  /** Landing page variant for domain-specific content */
  variant: LandingVariant;
}

export default function SampleGallery({ variant }: SampleGalleryProps) {
  // Use domain-specific translations for title/subtitle
  const tLanding = useTranslations(`landing.${variant}.gallery`);
  // Use legacy translations for shared content
  const t = useTranslations('gallery');
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
      <section className="py-20 sm:py-24 lg:py-32 bg-bg-white relative grain-texture">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-text-dark mb-8 leading-tight">
              {tLanding('title')}
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-text-body max-w-3xl mx-auto leading-relaxed">
              {tLanding('subtitle')}
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
                  className={`group relative bg-bg-gray-50 rounded-3xl overflow-hidden shadow-depth-lg border-2 border-brand-primary-lighter/20 hover:shadow-depth-2xl hover:border-brand-primary-lighter/50 transition-all duration-500 hover:-translate-y-3 ${index === 1 ? 'lg:mt-8' : '' // Stagger middle item on desktop
                    }`}
                >
                  {/* Interactive Before/After Slider */}
                  <div
                    className="relative aspect-square bg-bg-gray-50 overflow-hidden cursor-ew-resize"
                  >
                    {/* Background: After image (now background so left = Before) */}
                    <Image
                      src={`${photo.after}?v=4`}
                      alt={`${photo.alt} - After`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 350px"
                      loading="lazy"
                    />

                    {/* Foreground: Before image clipped to slider position */}
                    <div className="absolute inset-0">
                      <Image
                        src={`${photo.before}?v=3`}
                        alt={`${photo.alt} - Before`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 350px"
                        loading="lazy"
                        style={{ clipPath: `inset(0 ${100 - (sliderPositions[photo.id] || 50)}% 0 0)` }}
                      />
                    </div>

                    {/* Slider handle */}
                    <button
                      onMouseDown={(e) => onMouseDown(photo.id, e)}
                      onTouchStart={(e) => onTouchStart(photo.id, e)}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-bg-white shadow-depth-lg border-2 border-brand-primary/30 flex items-center justify-center text-sm z-20 select-none ${draggingId === photo.id
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

                    {/* Always-visible Before/After labels */}
                    <div className="pointer-events-none z-10">
                      <div className="absolute top-4 left-4 bg-brand-cta text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                        {t('before')}
                      </div>
                      <div className="absolute top-4 right-4 bg-brand-secondary text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-depth-md border-2 border-white/30">
                        {t('after')}
                      </div>
                    </div>
                  </div>

                  {/* Attribution with Enhanced Styling */}
                  {photo.attribution && (
                    <div className="p-5 bg-bg-white group-hover:bg-bg-gray-50 transition-colors duration-300">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-text-dark font-display">
                          {photo.attribution.name}
                        </p>
                        {photo.attribution.linkedinUrl && (
                          <a
                            href={photo.attribution.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A66C2] hover:text-[#004182] transition-colors flex-shrink-0"
                            aria-label={`${photo.attribution.name} on LinkedIn`}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-text-body mt-1">
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
                  variant,
                })
              }
              className="inline-flex items-center justify-center bg-gradient-to-r from-brand-cta to-brand-cta-hover text-white px-12 py-6 rounded-2xl font-bold text-lg lg:text-xl hover:shadow-depth-2xl hover:shadow-brand-cta-shadow/50 transition-all duration-300 shadow-depth-xl transform hover:-translate-y-2 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-bg-white"
            >
              {tLanding('cta')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
