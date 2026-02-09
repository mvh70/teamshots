'use client'

import { useRouter } from '@/i18n/routing'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface BackHeaderProps {
  backUrl: string
  title: string
  subtitle?: string
}

export default function BackHeader({ backUrl, title, subtitle }: BackHeaderProps) {
  const router = useRouter()

  return (
    <div className="flex items-start gap-4 mb-8">
      <button
        onClick={() => router.push(backUrl)}
        className="p-2 -ml-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
        aria-label="Go back"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2" data-testid="page-title">{title}</h1>
        {subtitle ? (
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}


