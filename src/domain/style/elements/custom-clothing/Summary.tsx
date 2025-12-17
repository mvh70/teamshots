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

  const customClothingKey = settings.outfitS3Key || settings.assetId
  const showContent = settings.type === 'user-choice' || customClothingKey

  if (!showContent) return null

  // Track if image failed to load
  const [imageError, setImageError] = React.useState(false)

  return (
    <div id="style-custom-clothing" className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        <span className="underline decoration-2 underline-offset-2 font-semibold text-gray-800">Custom Outfit</span>
      </div>
      {customClothingKey && !imageError ? (
        <div className="ml-6">
          <div className="relative group/outfit">
            <Image
              src={getThumbnailUrl(customClothingKey)}
              alt="Custom outfit thumbnail"
              width={96}
              height={96}
              className="w-24 h-24 rounded-xl object-cover border-2 border-gray-300 shadow-md hover:shadow-lg transition-all duration-300 group-hover/outfit:scale-105"
              unoptimized
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/outfit:opacity-100 transition-opacity duration-300" />
          </div>
        </div>
      ) : (
        // Show "User choice" if type is user-choice OR if image failed to load
        (settings.type === 'user-choice' || imageError) && (
          <div className="ml-6 text-sm text-gray-600 inline-flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            <span>User choice</span>
          </div>
        )
      )}
    </div>
  )
}
