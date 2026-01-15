'use client'

import Image from 'next/image'
import type { SolutionConfig } from '@/config/solutions'

interface TrustLogosProps {
  solution: SolutionConfig
  locale: string
}

export function TrustLogos({ solution, locale }: TrustLogosProps) {
  const hasIndustryLogos = solution.industryLogos && solution.industryLogos.length > 0

  // Only show this section if there are industry-specific logos to display
  // Trust badges are already shown in the hero section, so no need to duplicate
  if (!hasIndustryLogos) {
    return null
  }

  return (
    <section className="py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative pt-4">
          {/* Decorative line */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-bg-white px-6 text-sm text-text-muted font-medium">
              {locale === 'es'
                ? `Usado por equipos de ${solution.label.toLowerCase()}`
                : `Trusted by ${solution.label.toLowerCase()} teams at`}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {solution.industryLogos!.map((logo, index) => (
            <div
              key={index}
              className="h-8 w-auto grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              <Image
                src={logo}
                alt="Company logo"
                width={120}
                height={32}
                className="h-full w-auto object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
