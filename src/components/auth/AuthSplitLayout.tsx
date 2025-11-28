'use client'

import React from 'react'

type AuthSplitLayoutProps = {
  left?: React.ReactNode
  children: React.ReactNode
}

export default function AuthSplitLayout({ left, children }: AuthSplitLayoutProps) {
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


