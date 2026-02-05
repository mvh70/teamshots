'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { getClientBrandInfo } from '@/config/domain'

type AuthSplitLayoutProps = {
  left?: React.ReactNode
  children: React.ReactNode
}

export default function AuthSplitLayoutClient({ left, children }: AuthSplitLayoutProps) {
  const pathname = usePathname()
  const { isIndividual } = getClientBrandInfo()

  // Portreya (individual) uses the Precision Studio design
  if (isIndividual) {
    return (
      <main className="min-h-screen bg-[#FAFAF9] relative overflow-hidden">
        {/* Subtle film grain texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF9]/90 backdrop-blur-md border-b border-[#0F172A]/5">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between h-16 sm:h-20">
              <a href="/" className="text-xl sm:text-2xl text-[#0F172A] tracking-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Portreya
              </a>
            </div>
          </div>
        </nav>

        {/* Decorative elements */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#B45309]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0F172A]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-28 lg:pt-40 pb-20">
          {/* Mobile brand header — visible only on mobile/tablet */}
          <div className="lg:hidden text-center mb-10">
            <p className="text-sm text-[#0F172A]/50 tracking-[0.15em] uppercase">AI-Powered Professional Headshots</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            {/* Left branding column */}
            <div className="hidden lg:block">
              {left}
            </div>
            {/* Right form column */}
            <div className="flex justify-center">
              {children}
            </div>
          </div>
        </div>

      </main>
    )
  }

  // TeamShotsPro uses the original design
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 via-purple-50/30 to-pink-50/20 relative grain-texture py-16 lg:py-24 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left branding column */}
          <div className="hidden lg:block">
            {left}
          </div>
          {/* Right form column */}
          <div className="flex justify-center">
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}


