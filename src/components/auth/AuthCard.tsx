'use client'

import React from 'react'
import { getClientBrandInfo } from '@/config/domain'

type AuthCardProps = {
  title?: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  const { isIndividual } = getClientBrandInfo()

  if (isIndividual) {
    // Portreya: restrained, angular, warm — matches Precision Studio design
    return (
      <div className="w-full max-w-md bg-white border border-[#0F172A]/10 shadow-xl p-10 lg:p-12 relative">
        {(title || subtitle) && (
          <div className="mb-10 text-center">
            {title && (
              <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] tracking-tight mb-2 leading-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>{title}</h2>
            )}
            {subtitle && (
              <div className="mt-4 text-base text-[#0F172A]/60 leading-relaxed">{subtitle}</div>
            )}
          </div>
        )}
        <div>{children}</div>
      </div>
    )
  }

  // TeamShotsPro: original rounded design
  return (
    <div className="w-full max-w-md bg-white/98 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/60 p-10 lg:p-12 transform transition-all duration-300 hover:shadow-3xl relative">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      {/* Enhanced shadow layers */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500 -z-10" />
      {(title || subtitle) && (
        <div className="mb-10 text-center relative z-10">
          {title && (
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 tracking-tight mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent leading-tight">{title}</h2>
          )}
          {subtitle && (
            <div className="mt-4 text-base lg:text-lg text-slate-600 leading-relaxed font-medium">{subtitle}</div>
          )}
        </div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
