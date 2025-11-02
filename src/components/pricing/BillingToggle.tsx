'use client'

import { useTranslations } from 'next-intl'

interface BillingToggleProps {
  isYearly: boolean
  onChange: (isYearly: boolean) => void
  className?: string
}

export default function BillingToggle({ isYearly, onChange, className }: BillingToggleProps) {
  const t = useTranslations('pricing')
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <div className="bg-gray-100 p-1 rounded-lg inline-flex">
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            !isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
          type="button"
        >
          {t('monthly') || 'Monthly'}
        </button>
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
          type="button"
        >
          {t('yearly') || 'Yearly'}
        </button>
      </div>
    </div>
  )
}


