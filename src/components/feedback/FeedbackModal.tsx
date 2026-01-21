'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { Toast } from '@/components/ui/Toast'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  context: 'landing' | 'dashboard'
}

type Category = 'bug' | 'suggestion' | 'question' | 'other'
type Rating = 'up' | 'down'

export function FeedbackModal({ isOpen, onClose, context }: FeedbackModalProps) {
  const { data: session } = useSession()
  const t = useTranslations('feedback')
  const { track } = useAnalytics()
  const [category, setCategory] = useState<Category | ''>('')
  const [rating, setRating] = useState<Rating | ''>('')
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleTab = (e: KeyboardEvent) => {
      if (!modalRef.current) return

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleTab)

    // Focus first input when modal opens
    setTimeout(() => {
      firstInputRef.current?.focus()
    }, 100)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTab)
    }
  }, [isOpen, onClose])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!rating) {
      setToastMessage(t('form.ratingRequired'))
      setToastType('error')
      setShowToast(true)
      return
    }

    if (!category) {
      setToastMessage(t('form.categoryRequired'))
      setToastType('error')
      setShowToast(true)
      return
    }

    if (category === 'other' && !comment.trim()) {
      setToastMessage(t('form.commentRequired'))
      setToastType('error')
      setShowToast(true)
      return
    }

    // For anonymous users (landing page), email is required
    if (!session?.user && !email.trim()) {
      setToastMessage(t('form.emailRequired'))
      setToastType('error')
      setShowToast(true)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'general',
          rating,
          comment: comment.trim() || undefined,
          context,
          category,
          email: !session?.user ? email.trim() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('error'))
      }

      // Track success
      track('feedback_submitted', {
        type: 'general',
        rating,
        context,
        category,
        has_comment: !!comment.trim(),
      })

      setToastMessage(t('success'))
      setToastType('success')
      setShowToast(true)

      // Reset form and close after a delay
      setTimeout(() => {
        setCategory('')
        setRating('')
        setComment('')
        setEmail('')
        onClose()
      }, 1500)
    } catch {
      setToastMessage(t('error'))
      setToastType('error')
      setShowToast(true)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        aria-describedby="feedback-modal-description"
      >
        <div
          className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2
                id="feedback-modal-title"
                className="text-xl font-bold text-gray-900"
              >
                {t('modal.title')}
              </h2>
              <p
                id="feedback-modal-description"
                className="text-sm text-gray-600 mt-1"
              >
                {t('modal.description')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary rounded"
              aria-label={t('form.cancel')}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Selection */}
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.category')}
              </legend>
              <div className="space-y-2">
                {(['bug', 'suggestion', 'question', 'other'] as Category[]).map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat}
                      checked={category === cat}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className="mr-3"
                      required
                    />
                    <span className="text-sm text-gray-700">{t(`categories.${cat}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Rating */}
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.rating')}
              </legend>
              <div className="flex gap-4" role="group" aria-label={t('form.rating')}>
                <button
                  type="button"
                  onClick={() => setRating('up')}
                  aria-pressed={rating === 'up'}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    rating === 'up'
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">👍</span>
                  <span className="text-sm font-medium">{t('rating.up')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRating('down')}
                  aria-pressed={rating === 'down'}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    rating === 'down'
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">👎</span>
                  <span className="text-sm font-medium">{t('rating.down')}</span>
                </button>
              </div>
            </fieldset>

            {/* Email (for anonymous users) */}
            {!session?.user && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('form.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  required
                  placeholder={t('form.emailPlaceholder')}
                />
              </div>
            )}

            {/* Comment */}
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.comment')}
                {category === 'other' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                placeholder={t('form.commentPlaceholder')}
                required={category === 'other'}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {t('form.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('submitting') : t('form.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  )
}

