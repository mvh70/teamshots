import StyleSummary from '@/components/styles/StyleSummary'
import type { PhotoStyleSummarySettings } from '@/components/styles/StyleSummary'

interface StyleSummaryCardProps {
  settings?: PhotoStyleSummarySettings | null
  stylePreset?: string
  legacyBackgroundUrl?: string | null
  legacyBackgroundPrompt?: string | null
  legacyLogoUrl?: string | null
}

export default function StyleSummaryCard(props: StyleSummaryCardProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-gray-800 mb-2">Photo Style</h4>
      <StyleSummary {...props} />
    </div>
  )
}


