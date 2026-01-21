'use client'

import React from 'react'
import Image from 'next/image'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import type { ElementSummaryProps } from '../metadata'
import type { CustomClothingSettings } from './types'

function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export function CustomClothingSummary({ settings }: ElementSummaryProps<CustomClothingSettings>) {
  if (!settings) return null

  const customClothingKey = settings.value?.outfitS3Key || settings.value?.assetId
  const showContent = settings.mode === 'user-choice' || customClothingKey

  if (!showContent) return null

  const [imageError, setImageError] = React.useState(false)

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-[13px] text-gray-500">Custom Outfit</span>
      <div className="text-[13px]">
        {customClothingKey && !imageError ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-800 font-medium">Uploaded</span>
            <Image
              src={getThumbnailUrl(customClothingKey)}
              alt="Custom outfit"
              width={28}
              height={28}
              className="w-7 h-7 rounded-md object-cover border border-gray-200 shadow-sm"
              unoptimized
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          (settings.mode === 'user-choice' || imageError) && (
            <span className="inline-flex items-center gap-1.5 text-amber-600">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>User choice</span>
            </span>
          )
        )}
      </div>
    </div>
  )
}
