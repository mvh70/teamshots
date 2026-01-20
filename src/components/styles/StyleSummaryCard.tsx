import StyleSummary from '@/components/styles/StyleSummary'
import type { PhotoStyleSummarySettings } from '@/components/styles/StyleSummary'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface StyleSummaryCardProps {
  settings?: PhotoStyleSummarySettings | null
  packageId?: string
}

export default function StyleSummaryCard({ settings, packageId }: StyleSummaryCardProps) {
  return (
    <div className="relative bg-gradient-to-br from-gray-50 via-white to-gray-50/80 rounded-2xl p-6 md:p-7 border border-gray-200/60 shadow-md shadow-gray-200/20 hover:shadow-lg hover:shadow-gray-300/30 transition-all duration-300 hover:-translate-y-0.5">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 -mt-3 -mr-3 h-20 w-20 bg-gradient-to-br from-brand-primary/8 to-brand-secondary/8 rounded-full blur-2xl opacity-60" />
      <div className="absolute bottom-0 left-0 -mb-3 -ml-3 h-16 w-16 bg-gradient-to-tr from-brand-secondary/5 to-brand-primary/5 rounded-full blur-xl opacity-40" />
      
      <div className="relative space-y-4">
        {/* Header with icon */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200/60">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-primary via-brand-primary-hover to-brand-primary flex items-center justify-center shadow-md shadow-brand-primary/25 ring-2 ring-brand-primary/10">
            <PhotoIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <h4 className="text-lg font-display font-bold text-gray-900 tracking-tight">Composition</h4>
        </div>
        
        {/* Content */}
        <div className="pt-2">
          <StyleSummary settings={settings} packageId={packageId} />
        </div>
      </div>
    </div>
  )
}


