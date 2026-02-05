'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export interface BeforeAfterSliderProps {
  /** Before image source */
  beforeSrc: string;
  /** After image source */
  afterSrc: string;
  /** Alt text for the images */
  alt: string;
  /** Initial slider position (0-100), default 50 */
  initialPosition?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Aspect ratio - defaults to 'square' (1:1) */
  aspectRatio?: 'square' | '4/3' | '3/4' | '16/9';
  /** Whether to show the "drag to compare" hint */
  showHint?: boolean;
  /** Whether to show the stats badge at bottom */
  showStatsBadge?: boolean;
  /** Custom stats badge text (uses translation if not provided) */
  statsBadgeText?: string;
  /** Image loading priority */
  priority?: boolean;
  /** Image sizes for responsive loading */
  sizes?: string;
  /** Additional class name for the container */
  className?: string;
  /** Callback when slider position changes */
  onPositionChange?: (position: number) => void;
  /** Custom label for before image (uses translation if not provided) */
  beforeLabel?: string;
  /** Custom label for after image (uses translation if not provided) */
  afterLabel?: string;
  /** Auto-animate on load to show the transformation (default: true) */
  autoAnimate?: boolean;
}

/**
 * Reusable Before/After comparison slider component.
 * Shows dynamic labels based on slider position - only the currently dominant side is labeled.
 */
export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  alt,
  initialPosition = 50,
  size = 'md',
  aspectRatio = 'square',
  showHint = false,
  showStatsBadge = false,
  statsBadgeText,
  priority = false,
  sizes = '(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 400px',
  className = '',
  onPositionChange,
  beforeLabel,
  afterLabel,
  autoAnimate = true,
}: BeforeAfterSliderProps) {
  const t = useTranslations('gallery');

  // Use custom labels if provided, otherwise use translations
  const beforeText = beforeLabel || t('before');
  const afterText = afterLabel || t('after');
  const [isInteracting, setIsInteracting] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Refs for cleanup on unmount
  const cleanupRef = useRef<(() => void) | null>(null);

  // Auto-animate on first load to show the transformation
  useEffect(() => {
    if (!autoAnimate || hasAnimated || isInteracting) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setHasAnimated(true);
      return;
    }

    // Start animation after a short delay
    const startDelay = setTimeout(() => {
      // Animate from initial position to show "before" (80%)
      setSliderPosition(80);

      // Then animate back to show "after" (20%)
      const toAfterTimeout = setTimeout(() => {
        setSliderPosition(20);

        // Finally settle at middle
        const settleTimeout = setTimeout(() => {
          setSliderPosition(50);
          setHasAnimated(true);
        }, 600);

        return () => clearTimeout(settleTimeout);
      }, 600);

      return () => clearTimeout(toAfterTimeout);
    }, 500);

    return () => clearTimeout(startDelay);
  }, [autoAnimate, hasAnimated, isInteracting]);

  // Cleanup listeners on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleDrag = useCallback((clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
    onPositionChange?.(percentage);
  }, [onPositionChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setIsInteracting(true);

    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDrag(e.clientX, rect);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      cleanupRef.current = null;
    };

    // Store cleanup function for unmount case
    cleanupRef.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [handleDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setIsInteracting(true);

    const container = e.currentTarget.parentElement as HTMLDivElement;
    const rect = container.getBoundingClientRect();

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleDrag(e.touches[0].clientX, rect);
    };

    const onTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      cleanupRef.current = null;
    };

    // Store cleanup function for unmount case
    cleanupRef.current = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }, [handleDrag]);

  // Size variants
  const handleSizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-14 h-14 text-lg',
  };

  const labelSizes = {
    sm: 'px-2.5 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-xs',
  };

  const labelPositions = {
    sm: 'top-3 left-3 right-3',
    md: 'top-4 left-4 right-4',
    lg: 'top-5 left-5 right-5',
  };

  return (
    <div className={`relative bg-gray-100 overflow-hidden cursor-ew-resize ${
      aspectRatio === 'square' ? 'aspect-square' :
      aspectRatio === '4/3' ? 'aspect-[4/3]' :
      aspectRatio === '3/4' ? 'aspect-[3/4]' :
      aspectRatio === '16/9' ? 'aspect-video' : 'aspect-square'
    } ${className}`}>
      {/* Background: After image (shown when slider is to the left) */}
      <Image
        src={afterSrc}
        alt={`${alt} - ${afterText}`}
        fill
        className="object-cover"
        priority={priority}
        sizes={sizes}
      />

      {/* Foreground: Before image clipped to slider position */}
      <div className="absolute inset-0">
        <Image
          src={beforeSrc}
          alt={`${alt} - ${beforeText}`}
          fill
          className="object-cover"
          priority={priority}
          sizes={sizes}
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
            transition: isDragging ? 'none' : (!hasAnimated && autoAnimate ? 'clip-path 0.5s ease-in-out' : undefined)
          }}
        />
      </div>

      {/* Slider handle with keyboard support */}
      <button
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            const newPos = Math.max(0, sliderPosition - step);
            setSliderPosition(newPos);
            onPositionChange?.(newPos);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            const newPos = Math.min(100, sliderPosition + step);
            setSliderPosition(newPos);
            onPositionChange?.(newPos);
          } else if (e.key === 'Home') {
            e.preventDefault();
            setSliderPosition(0);
            onPositionChange?.(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setSliderPosition(100);
            onPositionChange?.(100);
          }
        }}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(sliderPosition)}
        aria-label="Compare before and after images"
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-depth-xl border-3 border-brand-primary/30 flex items-center justify-center z-20 select-none ${handleSizes[size]} ${
          isDragging
            ? 'cursor-ew-resize scale-105'
            : 'hover:shadow-depth-2xl hover:scale-110 transition-all duration-300 active:scale-95'
        }`}
        style={{
          left: `${sliderPosition}%`,
          transition: isDragging ? 'none' : (!hasAnimated && autoAnimate ? 'left 0.5s ease-in-out' : undefined)
        }}
      >
        <span className="text-brand-primary font-bold">⇄</span>
      </button>

      {/* Interactive Hint - Shows on first load if enabled */}
      {showHint && !isInteracting && (
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-5 transition-all duration-500 pointer-events-none z-10">
          <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-white/95 backdrop-blur-sm text-gray-900 px-6 py-3 rounded-full shadow-depth-xl border border-gray-200/50 flex items-center gap-2 animate-bounce">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span className="text-sm font-semibold">{t('dragToCompare')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Labels based on slider position - only show the dominant side */}
      <div className={`pointer-events-none z-10 ${labelPositions[size]}`}>
        {sliderPosition > 50 ? (
          <div className={`absolute ${labelPositions[size].split(' ')[0]} left-4 bg-brand-cta text-white rounded-full font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30 ${labelSizes[size]}`}>
            {beforeText}
          </div>
        ) : (
          <div className={`absolute ${labelPositions[size].split(' ')[0]} right-4 bg-brand-secondary text-white rounded-full font-bold uppercase tracking-wider shadow-depth-lg border-2 border-white/30 ${labelSizes[size]}`}>
            {afterText}
          </div>
        )}
      </div>

      {/* Stats Badge - Optional */}
      {showStatsBadge && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm text-gray-900 px-5 py-2.5 rounded-xl shadow-depth-xl border border-gray-200/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-bold">{statsBadgeText || t('generatedIn')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
