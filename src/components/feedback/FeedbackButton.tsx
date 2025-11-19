'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FeedbackModal } from './FeedbackModal'
import { useAnalytics } from '@/hooks/useAnalytics'

interface FeedbackButtonProps {
  context: 'landing' | 'dashboard'
}

export function FeedbackButton({ context }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { track } = useAnalytics()
  const t = useTranslations('feedback')

  const handleOpen = () => {
    setIsOpen(true)
    track('feedback_button_clicked', {
      context,
    })
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 bg-brand-primary text-white rounded-full p-4 shadow-lg hover:bg-brand-primary-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        aria-label={t('button')}
        title={t('button')}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      {isOpen && (
        <FeedbackModal
          isOpen={isOpen}
          onClose={handleClose}
          context={context}
        />
      )}
    </>
  )
}

