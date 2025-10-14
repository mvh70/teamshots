'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ReactCompareImage from 'react-compare-image';
import { BRAND_CONFIG } from '@/config/brand';

interface SamplePhoto {
  id: string;
  before: string;
  after: string;
  alt: string;
  attribution?: {
    name: string;
    role: string;
    company: string;
  };
}

// Sample data - using local transformation images
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1',
    before: '/samples/before-1.jpg',
    after: '/samples/after-1.png',
    alt: 'Professional headshot transformation example 1',
    attribution: {
      name: 'Matthieu van Haperen',
      role: 'Entrepreneur',
      company: 'Carpe Diem Ventures'
    }
  },
  {
    id: '2', 
    before: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop&auto=format',
    after: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&auto=format',
    alt: 'Professional headshot transformation example 2',
    attribution: {
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      company: 'Digital Agency'
    }
  },
  {
    id: '3',
    before: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=600&fit=crop&auto=format',
    after: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop&auto=format',
    alt: 'Professional headshot transformation example 3',
    attribution: {
      name: 'David Rodriguez',
      role: 'Product Manager',
      company: 'SaaS Company'
    }
  }
];

export default function SampleGallery() {
  const t = useTranslations('gallery');
  const [selectedPhoto, setSelectedPhoto] = useState<SamplePhoto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
                  <div className="relative aspect-square">
                    <ReactCompareImage
                      leftImage={photo.before}
                      rightImage={photo.after}
                      leftImageAlt={`${photo.alt} - Before`}
                      rightImageAlt={`${photo.alt} - After`}
                      sliderLineColor={BRAND_CONFIG.colors.cta}
                      sliderLineWidth={3}
                      handleSize={40}
                      hover={true}
                    />
                  </div>

                  {/* Attribution */}
                  {photo.attribution && (
                    <div className="p-4 bg-white">
                      <p className="text-sm font-semibold text-gray-900">
                        {photo.attribution.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {photo.attribution.role} • {photo.attribution.company}
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
            <button className="bg-brand-cta text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-cta-hover transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              {t('tryWithSample')}
            </button>
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
              <div className="relative aspect-video max-w-3xl mx-auto">
                <ReactCompareImage
                  leftImage={selectedPhoto.before}
                  rightImage={selectedPhoto.after}
                  leftImageAlt={`${selectedPhoto.alt} - Before`}
                  rightImageAlt={`${selectedPhoto.alt} - After`}
                  sliderLineColor={BRAND_CONFIG.colors.cta}
                  sliderLineWidth={4}
                  handleSize={50}
                  hover={true}
                />
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
