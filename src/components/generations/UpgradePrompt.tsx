'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'

interface UpgradePromptProps {
  className?: string
}

export function UpgradePrompt({ className = '' }: UpgradePromptProps) {
  const t = useTranslations('generations.upgradePrompt')
  const router = useRouter()

  const handleUpgradeClick = () => {
    router.push('/app/upgrade')
  }

  return (
    <div className={`bg-gradient-to-r from-brand-primary/10 to-brand-primary/5 border border-brand-primary/20 rounded-lg p-6 text-center ${className}`}>
      <div className="max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('title')}
        </h3>
        <p className="text-gray-600 mb-4">
          {t('description')}
        </p>
        <button
          onClick={handleUpgradeClick}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
        >
          {t('button')}
        </button>
      </div>
    </div>
  )
}
