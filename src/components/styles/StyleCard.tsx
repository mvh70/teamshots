'use client'

import StyleSummaryCard from '@/components/styles/StyleSummaryCard'
import type { PhotoStyleSummarySettings as SummarySettings } from '@/components/styles/StyleSummary'
import UserStyleSummary from '@/components/styles/UserStyleSummary'
import { Grid } from '@/components/ui'

interface StyleCardProps {
  settings?: unknown
  className?: string
}

export default function StyleCard({
  settings,
  className
}: StyleCardProps) {
  return (
    <div className={className} data-testid="style-card">
      <Grid cols={{ mobile: 2 }} gap="md" className="text-sm text-gray-600">
        <StyleSummaryCard
          settings={(settings as SummarySettings) || undefined}
        />
        <UserStyleSummary settings={settings as Parameters<typeof UserStyleSummary>[0]['settings']}         />
      </Grid>
    </div>
  )
}


