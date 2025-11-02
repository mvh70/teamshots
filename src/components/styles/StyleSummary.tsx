'use client'

import Image from 'next/image'

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
}

interface StyleSummaryProps {
  settings?: PhotoStyleSummarySettings | null
  stylePreset?: string
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

export default function StyleSummary({ settings, stylePreset, legacyBackgroundUrl, legacyBackgroundPrompt, legacyLogoUrl }: StyleSummaryProps) {
  const backgroundKey = settings?.background?.key || extractKeyFromUrl(legacyBackgroundUrl)
  const backgroundPrompt = settings?.background?.prompt || legacyBackgroundPrompt || undefined
  const backgroundType = settings?.background?.type
  const backgroundColor = settings?.background?.color

  const logoKey = settings?.branding?.logoKey || extractKeyFromUrl(legacyLogoUrl)
  const brandingType = settings?.branding?.type
  const logoPosition = settings?.branding?.position

  return (
    <div className="space-y-2">
      {(backgroundKey || backgroundPrompt || backgroundType) && (
        <div className="flex items-center gap-2">
          <strong>Background:</strong>
          {backgroundKey ? (
            <div className="flex items-center gap-2">
              <Image
                src={getThumbnailUrl(backgroundKey)}
                alt="Background thumbnail"
                width={24}
                height={24}
                className="w-6 h-6 rounded object-cover border border-gray-200"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <span>Custom</span>
            </div>
          ) : backgroundPrompt ? (
            <span>AI Generated: {backgroundPrompt}</span>
          ) : backgroundType === 'gradient' ? (
            <div className="flex items-center gap-2">
              {backgroundColor && backgroundColor.startsWith('#') ? (
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}40)` }}
                />
              ) : null}
              <span>Gradient {backgroundColor ? `(${backgroundColor})` : ''}</span>
            </div>
          ) : backgroundType === 'neutral' ? (
            <div className="flex items-center gap-2">
              {backgroundColor && backgroundColor.startsWith('#') ? (
                <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: backgroundColor }} />
              ) : null}
              <span>Solid {backgroundColor || '#ffffff'}</span>
            </div>
          ) : (
            <span className="capitalize">{backgroundType || 'Office'} style</span>
          )}
        </div>
      )}

      {(logoKey || brandingType) && (
        <div className="flex items-center gap-2">
          <strong>Logo:</strong>
          {logoKey ? (
            <div className="flex flex-col gap-1">
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
                <span className="text-xs text-gray-500">Position: {logoPosition}</span>
              )}
            </div>
          ) : (
            <span className="capitalize">{brandingType === 'include' ? 'Included' : 'Excluded'}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <strong>Style:</strong>
        <span className="capitalize">{stylePreset}</span>
      </div>
    </div>
  )
}


