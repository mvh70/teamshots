'use client'

import React from 'react'

type AuthCardProps = {
  title?: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-xl shadow-lg border border-gray-100 p-8">
      {(title || subtitle) && (
        <div className="mb-6 text-center">
          {title && (
            <h2 className="text-3xl font-extrabold text-gray-900">{title}</h2>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}


