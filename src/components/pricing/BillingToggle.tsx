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
      <div className="relative bg-bg-white p-1.5 rounded-2xl inline-flex shadow-depth-lg border-2 border-brand-primary-lighter hover:border-brand-primary transition-all duration-300">
        <button
          onClick={() => onChange(false)}
          className={`relative px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
            !isYearly
              ? 'bg-brand-primary text-white shadow-depth-md scale-105'
              : 'text-text-body hover:text-brand-primary active:scale-95'
          }`}
          type="button"
          aria-pressed={!isYearly}
          aria-label={t('monthly') || 'Monthly'}
        >
          {t('monthly') || 'Monthly'}
        </button>
        <button
          onClick={() => onChange(true)}
          className={`relative px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${
            isYearly
              ? 'bg-brand-primary text-white shadow-depth-md scale-105'
              : 'text-text-body hover:text-brand-primary active:scale-95'
          }`}
          type="button"
          aria-pressed={isYearly}
          aria-label={t('yearly') || 'Yearly'}
        >
          {t('yearly') || 'Yearly'}
        </button>
      </div>
    </div>
  )
}


