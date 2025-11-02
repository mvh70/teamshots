'use client'

import StyleSummaryCard from '@/components/styles/StyleSummaryCard'
import type { PhotoStyleSummarySettings as SummarySettings } from '@/components/styles/StyleSummary'
import UserStyleSummary from '@/components/styles/UserStyleSummary'

interface StyleCardProps {
  settings?: unknown
  stylePreset?: string
  legacyBackgroundUrl?: string | null
  legacyBackgroundPrompt?: string | null
  legacyLogoUrl?: string | null
  className?: string
}

export default function StyleCard({
  settings,
  stylePreset,
  legacyBackgroundUrl,
  legacyBackgroundPrompt,
  legacyLogoUrl,
  className
}: StyleCardProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
        <StyleSummaryCard
          settings={(settings as SummarySettings) || undefined}
          stylePreset={stylePreset}
          legacyBackgroundUrl={legacyBackgroundUrl || undefined}
          legacyBackgroundPrompt={legacyBackgroundPrompt || undefined}
          legacyLogoUrl={legacyLogoUrl || undefined}
        />
        <UserStyleSummary settings={settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
      </div>
    </div>
  )
}


