import React from 'react'
import Image from 'next/image'

interface SelectedSelfiePreviewProps {
  title?: string
  url: string
  className?: string
}

export default function SelectedSelfiePreview({
  title = 'Selected Selfie',
  url,
  className = ''
}: SelectedSelfiePreviewProps) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
        <Image
          src={url}
          alt={title}
          fill
          className="object-cover"
        />
      </div>
    </div>
  )
}


