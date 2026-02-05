'use client';

import BeforeAfterSlider from '@/components/BeforeAfterSlider';

// Featured hero example - using local transformation images (WebP for performance)
const HERO_PHOTO = {
  before: '/samples/before-hero.webp',
  after: '/samples/after-hero.webp',
  alt: 'Professional headshot transformation - AI powered'
};

export default function HeroGallery() {
  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Interactive Before/After Slider with Enhanced Styling */}
      <div className="relative rounded-3xl overflow-hidden shadow-depth-2xl bg-gray-100 border-2 border-white/50 hover:shadow-floating transition-all duration-500">
        <BeforeAfterSlider
          beforeSrc={HERO_PHOTO.before}
          afterSrc={HERO_PHOTO.after}
          alt={HERO_PHOTO.alt}
          size="lg"
          showHint={true}
          showStatsBadge={true}
          priority={true}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 400px"
        />
      </div>
    </div>
  );
}

