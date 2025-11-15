/**
 * Reusable animation utilities for the landing page
 * Provides consistent animation patterns with performance optimization
 */

export const ANIMATION_DELAYS = {
  hero: {
    title: 0,
    subtitle: 200,
    cta: 400,
    gallery: 600,
  },
  stagger: {
    base: 100,
    medium: 150,
    slow: 200,
  },
};

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Intersection Observer hook for scroll-triggered animations
 */
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  if (typeof window === 'undefined') return null;

  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px',
  };

  return new IntersectionObserver(callback, { ...defaultOptions, ...options });
};

/**
 * Apply fade-in animation with optional delay
 */
export const fadeIn = (delay: number = 0) => ({
  opacity: 0,
  transform: 'translateY(20px)',
  transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
});

/**
 * Apply fade-in visible state
 */
export const fadeInVisible = {
  opacity: 1,
  transform: 'translateY(0)',
};

/**
 * Generate stagger delays for array of items
 */
export const getStaggerDelay = (index: number, baseDelay: number = 100) => 
  index * baseDelay;
