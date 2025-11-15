'use client'

import React from 'react'

type AuthCardProps = {
  title?: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md bg-bg-white/95 backdrop-blur-sm rounded-3xl shadow-depth-xl border-2 border-brand-primary-lighter p-8 lg:p-10">
      {(title || subtitle) && (
        <div className="mb-8 text-center">
          {title && (
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-text-dark">{title}</h2>
          )}
          {subtitle && (
            <div className="mt-3 text-base lg:text-lg text-text-body leading-relaxed">{subtitle}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}


