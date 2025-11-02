'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

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
      team: 'TeamShots'
    }
  }
];

export default function SampleGallery() {
  const t = useTranslations('gallery');
  const [selectedPhoto, setSelectedPhoto] = useState<SamplePhoto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const openModal = (photo: SamplePhoto) => {
    setSelectedPhoto(photo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

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
                        <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          {t('before')}
                        </div>
                      ) : (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
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

                  {/* Click to expand */}
                  <button
                    onClick={() => openModal(photo)}
                    className="absolute bottom-4 right-4 bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-shadow"
                  >
                    {t('viewComparison')}
                  </button>
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
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Modal */}
      {isModalOpen && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-semibold">
                  {t('comparisonView')}
                </h3>
                {selectedPhoto.attribution && (
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedPhoto.attribution.name} • {selectedPhoto.attribution.role}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              <div className="relative aspect-video max-w-3xl mx-auto bg-gray-100 overflow-hidden rounded-lg">
                {/* Background: After image */}
                <Image
                  src={selectedPhoto.after}
                  alt={`${selectedPhoto.alt} - After`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                
                {/* Foreground: Before image clipped to slider position */}
                <div className="absolute inset-0">
                  <Image
                    src={selectedPhoto.before}
                    alt={`${selectedPhoto.alt} - Before`}
                    fill
                    className="object-cover"
                    unoptimized
                    style={{ clipPath: `inset(0 ${100 - (sliderPositions[selectedPhoto.id] || 50)}% 0 0)` }}
                  />
                </div>

                {/* Slider handle */}
                <button
                  onMouseDown={(e) => onMouseDown(selectedPhoto.id, e)}
                  onTouchStart={(e) => onTouchStart(selectedPhoto.id, e)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg border-2 border-gray-300 flex items-center justify-center text-sm hover:shadow-xl transition-shadow"
                  style={{ left: `${sliderPositions[selectedPhoto.id] || 50}%` }}
                  aria-label="Drag slider"
                >
                  ⇆
                </button>

                {/* Dynamic Labels (right = Before, left = After) */}
                <div className="pointer-events-none">
                  {(sliderPositions[selectedPhoto.id] || 50) > 50 ? (
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                      {t('before')}
                    </div>
                  ) : (
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                      {t('after')}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">{t('before')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">{t('after')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
