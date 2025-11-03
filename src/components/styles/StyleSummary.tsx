'use client'

import Image from 'next/image'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'

export interface PhotoStyleSummarySettings {
  background?: {
    key?: string
    prompt?: string
    type?: string
    color?: string
  }
  branding?: {
    logoKey?: string
    type?: string
    position?: string
  }
  style?: {
    type?: string
    preset?: string
  }
  shotType?: {
    type?: string
  }
}

interface StyleSummaryProps {
  settings?: PhotoStyleSummarySettings | null
  legacyBackgroundUrl?: string | null
  legacyBackgroundPrompt?: string | null
  legacyLogoUrl?: string | null
}

function extractKeyFromUrl(url: string | null | undefined): string | undefined {
  try {
    if (!url) return undefined
    const urlObj = new URL(url)
    return urlObj.searchParams.get('key') || undefined
  } catch {
    return undefined
  }
}

function getThumbnailUrl(key: string): string {
  return `/api/files/get?key=${encodeURIComponent(key)}`
}

export default function StyleSummary({ settings, legacyBackgroundUrl, legacyBackgroundPrompt, legacyLogoUrl }: StyleSummaryProps) {
  const backgroundKey = settings?.background?.key || extractKeyFromUrl(legacyBackgroundUrl)
  const backgroundPrompt = settings?.background?.prompt || legacyBackgroundPrompt || undefined
  const backgroundType = settings?.background?.type
  const backgroundColor = settings?.background?.color
  const backgroundImageUrl = backgroundKey ? getThumbnailUrl(backgroundKey) : (legacyBackgroundUrl || undefined)
  const isHexColor = (value?: string): boolean => {
    if (!value) return false
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  }

  const logoKey = settings?.branding?.logoKey || extractKeyFromUrl(legacyLogoUrl)
  const brandingType = settings?.branding?.type
  const logoPosition = settings?.branding?.position
  // Style preset computed but intentionally not displayed on the summary card
  const shotType = settings?.shotType?.type

  return (
    <div className="space-y-2">
      {(backgroundKey || backgroundPrompt || backgroundType) && (
        backgroundType === 'gradient' && backgroundColor ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline">Background</span>
            </div>
            <div className="flex items-center gap-2 ml-6 text-xs text-gray-500">
              {isHexColor(backgroundColor) ? (
                <div
                  className="w-3 h-3 rounded border border-gray-300"
                  style={{ background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}40)` }}
                />
              ) : (
                <span>{backgroundColor}</span>
              )}
            </div>
          </div>
        ) : backgroundType === 'neutral' && backgroundColor ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline">Background</span>
            </div>
            <div className="flex items-center gap-2 ml-6 text-xs text-gray-500">
              {isHexColor(backgroundColor) ? (
                <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor }} />
              ) : (
                <span>{backgroundColor}</span>
              )}
            </div>
          </div>
        ) : (
          (backgroundKey || backgroundImageUrl) ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline">Background</span>
              </div>
              <div className="flex items-center gap-2 ml-6 text-xs text-gray-500">
                <Image
                  src={backgroundImageUrl as string}
                  alt="Background thumbnail"
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded object-cover border border-gray-200"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </div>
          ) : (!backgroundImageUrl && backgroundType === 'custom') ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline">Background</span>
              </div>
              <div className="ml-6 text-xs text-red-600">Custom background missing</div>
            </div>
          ) : backgroundPrompt ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline">Background</span>
              </div>
              <div className="ml-6 text-xs text-gray-500">AI Generated: {backgroundPrompt}</div>
            </div>
          ) : backgroundType === 'user-choice' ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline">Background</span>
              </div>
              <div className="ml-6 text-xs text-gray-500 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                <span>User choice</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="underline">Background</span>
              </div>
              <div className="ml-6 text-xs text-gray-500 capitalize">{((backgroundType || 'office') as string).replace(/-/g, ' ')} style</div>
            </div>
          )
        )
      )}

      {(logoKey || brandingType) && (
        logoKey ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline">Branding</span>
            </div>
            <div className="ml-6 text-xs text-gray-500">
              <div className="w-12 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1">
                <Image
                  src={getThumbnailUrl(logoKey)}
                  alt="Logo thumbnail"
                  width={40}
                  height={24}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              {logoPosition && (
                <div className="text-xs text-gray-500 mt-1">Position: {logoPosition}</div>
              )}
            </div>
          </div>
        ) : brandingType === 'user-choice' ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline">Branding</span>
            </div>
            <div className="ml-6 text-xs text-gray-500 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
              <span>User choice</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="underline">Branding</span>
            </div>
            <div className="ml-6 text-xs text-gray-500">
              {brandingType === 'include' ? 'Logo included' : 'Logo excluded'}
            </div>
          </div>
        )
      )}

      {/* Style preset intentionally not displayed on summary card */}

      {shotType && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="underline">Shot type</span>
          </div>
          <div className="ml-6 text-xs text-gray-500 capitalize">
            {shotType === 'user-choice' ? (
              <span className="inline-flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
                User choice
              </span>
            ) : (
              shotType
            )}
          </div>
        </div>
      )}
    </div>
  )
}


