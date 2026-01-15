'use client'

import Link from 'next/link'
import Image from 'next/image'

interface BlogCTAProps {
  /** Heading text for the CTA */
  heading?: string
  /** Subheading/description text */
  subheading?: string
  /** CTA button text */
  buttonText?: string
  /** CTA button link */
  buttonHref?: string
}

/**
 * Call-to-action section for the blog page.
 * Encourages blog readers to try the product.
 */
export default function BlogCTA({
  heading = 'Ready to get your professional headshots?',
  subheading = 'Join thousands of professionals who have transformed their online presence with AI-powered headshots.',
  buttonText = 'Get Started Free',
  buttonHref = '/auth/signup',
}: BlogCTAProps) {
  // Sample headshot images for visual interest
  const sampleImages = [
    '/images/expressions/genuine_smile.png',
    '/images/expressions/soft_smile.png',
    '/images/expressions/neutral_serious.png',
    '/images/expressions/laugh_joy.png',
  ]

  return (
    <section className="mt-16 mb-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 px-8 py-12 md:px-12 md:py-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-brand-primary to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_var(--tw-gradient-stops))] from-brand-primary/50 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Text Content */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {heading}
            </h2>
            <p className="text-gray-300 text-lg mb-6 max-w-xl">
              {subheading}
            </p>
            <Link
              href={buttonHref}
              className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold px-6 py-3 rounded-lg transition-all hover:scale-105"
            >
              {buttonText}
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>

          {/* Sample Headshots Grid */}
          <div className="flex-shrink-0">
            <div className="grid grid-cols-2 gap-3">
              {sampleImages.map((src, index) => (
                <div
                  key={index}
                  className="relative w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden ring-2 ring-white/20"
                >
                  <Image
                    src={src}
                    alt={`Sample headshot ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-center text-gray-400 text-xs mt-3">
              AI-generated samples
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
