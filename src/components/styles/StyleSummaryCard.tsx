import StyleSummary from '@/components/styles/StyleSummary'
import type { PhotoStyleSummarySettings } from '@/components/styles/StyleSummary'
import { CameraIcon } from '@heroicons/react/24/outline'

interface StyleSummaryCardProps {
  settings?: PhotoStyleSummarySettings | null
  packageId?: string
}

export default function StyleSummaryCard({ settings, packageId }: StyleSummaryCardProps) {
  return (
    <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
      {/* Refined header with gradient background */}
      <div className="relative px-5 py-4 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 border-b border-gray-100 rounded-t-2xl overflow-hidden">
        {/* Subtle decorative element */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-brand-primary/[0.03] to-transparent rounded-bl-full" />

        <div className="relative flex items-center gap-3.5">
          {/* Icon with refined treatment */}
          <div className="relative flex-shrink-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-primary/10 via-brand-primary/5 to-transparent flex items-center justify-center border border-brand-primary/10">
              <CameraIcon className="h-5 w-5 text-brand-primary" strokeWidth={1.75} />
            </div>
          </div>

          {/* Title */}
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-gray-800 tracking-wide uppercase">
              Composition
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">Photo settings</p>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-5 py-4 flex-1">
        <StyleSummary settings={settings} packageId={packageId} />
      </div>
    </div>
  )
}
