'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { DangerButton, SecondaryButton } from '@/components/ui'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  remainingRegenerations: number
  isDeleting: boolean
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  remainingRegenerations,
  isDeleting,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations('generations.actions.deleteConfirmation')
  const tActions = useTranslations('generations.actions')
  const modalRef = useRef<HTMLDivElement>(null)

  const hasRetries = remainingRegenerations > 0

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }

    const handleTab = (e: KeyboardEvent) => {
      if (!modalRef.current) return

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleTab)

    // Focus first focusable element when modal opens
    setTimeout(() => {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements?.[0] as HTMLElement
      firstElement?.focus()
    }, 100)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTab)
    }
  }, [isOpen, onClose, isDeleting])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const dialogMarkup = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={!isDeleting ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <div
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h2
            id="delete-dialog-title"
            className="text-xl font-bold text-gray-900 text-center mb-2"
          >
            {t('title')}
          </h2>

          {/* Description */}
          <div id="delete-dialog-description" className="space-y-3 mb-6">
            <p className="text-sm text-gray-600 text-center">
              {hasRetries
                ? t('description', { count: remainingRegenerations })
                : t('descriptionNoRetries')}
            </p>
            <p className="text-sm text-gray-700 text-center font-medium">
              {hasRetries ? t('suggestion') : t('suggestionNoRetries')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <SecondaryButton
              onClick={onClose}
              disabled={isDeleting}
              fullWidth
              className="sm:flex-1"
            >
              {hasRetries ? t('cancelButton') : t('cancelButtonNoRetries')}
            </SecondaryButton>
            <DangerButton
              onClick={onConfirm}
              disabled={isDeleting}
              loading={isDeleting}
              loadingText={tActions('deleting')}
              fullWidth
              className="sm:flex-1"
            >
              {t('confirmButton')}
            </DangerButton>
          </div>
        </div>
      </div>
    </>
  )

  if (typeof window === 'object') {
    return createPortal(dialogMarkup, document.body)
  }

  return null
}
