'use client'

import React from 'react'

type AuthSplitLayoutProps = {
  left?: React.ReactNode
  children: React.ReactNode
}

export default function AuthSplitLayout({ left, children }: AuthSplitLayoutProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left branding column */}
        <div className="hidden lg:block">
          {left}
        </div>
        {/* Right form column */}
        <div className="flex justify-center">
          {children}
        </div>
      </div>
    </main>
  )
}


