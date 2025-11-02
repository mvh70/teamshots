'use client'

import React from 'react'

interface SettingsCardProps {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
  statusNode?: React.ReactNode
}

export default function SettingsCard({ title, description, className = '', children, statusNode }: SettingsCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description ? (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            ) : null}
          </div>
          {statusNode ? (
            <div className="shrink-0 self-start">{statusNode}</div>
          ) : null}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}


