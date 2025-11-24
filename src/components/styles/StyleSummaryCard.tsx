import StyleSummary from '@/components/styles/StyleSummary'
import type { PhotoStyleSummarySettings } from '@/components/styles/StyleSummary'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface StyleSummaryCardProps {
  settings?: PhotoStyleSummarySettings | null
}

export default function StyleSummaryCard(props: StyleSummaryCardProps) {
  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-6 border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 rounded-full blur-xl" />
      
      <div className="relative space-y-4">
        {/* Header with icon */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-primary to-brand-primary-hover flex items-center justify-center shadow-sm">
            <PhotoIcon className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <h4 className="text-lg font-bold text-gray-900">Composition</h4>
        </div>
        
        {/* Content */}
        <div className="pt-1">
          <StyleSummary {...props} />
        </div>
      </div>
    </div>
  )
}


