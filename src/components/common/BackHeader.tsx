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
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.push(backUrl)}
        className="p-2 text-gray-400 hover:text-gray-600"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? (
          <p className="text-gray-600 mt-1">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}


