'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useAnalytics } from '@/hooks/useAnalytics'
import { Toast } from '@/components/ui/Toast'
import { ThumbsUp, ThumbsDown, ChevronUp, ChevronDown } from 'lucide-react'

interface GenerationRatingProps {
  generationId: string
  token?: string
  generationStatus: 'pending' | 'processing' | 'completed' | 'failed'
  photoContainerRef?: React.RefObject<HTMLDivElement | null> // Accept the new ref
}

type Rating = 'up' | 'down'

const FEEDBACK_REASONS = [
  'poorQuality',
  'wrongStyle',
  'inaccurateFace',
  'wrongBackground',
  'other',
] as const

interface ExistingFeedback {
  id: string
  rating: 'up' | 'down'
  comment: string | null
  options: string[] | null
  createdAt: Date
}

export function GenerationRating({
  generationId,
  token,
  generationStatus,
  photoContainerRef, // Destructure the new prop
}: GenerationRatingProps) {
  const t = useTranslations('feedback')
  const { track } = useAnalytics()

  // All hooks must be declared at the top, before any conditional returns
  const [rating, setRating] = useState<Rating | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [showThankYou, setShowThankYou] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false) // Track if feedback was just submitted (not loaded)
  const pendingToastMessage = useRef<string>('') // Store toast message to prevent it from being lost
  const feedbackControlRef = useRef<HTMLDivElement>(null) // Ref for the button container
  const formRef = useRef<HTMLFormElement>(null) // Ref for the form container
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  // Load existing feedback on mount - fetches feedback when props change
  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    const loadExistingFeedback = async () => {
      if (generationStatus !== 'completed') {
        setLoadingExisting(false)
        return
      }

      try {
        const url = token
          ? `/api/feedback?generationId=${encodeURIComponent(generationId)}&token=${encodeURIComponent(token)}`
          : `/api/feedback?generationId=${encodeURIComponent(generationId)}`

        const response = await fetch(url)
        const data = await response.json()

        if (data.feedback) {
          const existing: ExistingFeedback = data.feedback
          setRating(existing.rating)
          setSubmitted(true) // Mark as submitted but don't show thank you (it's existing feedback)
          if (existing.rating === 'down') {
            setSelectedReasons((existing.options as string[]) || [])
            setComment(existing.comment || '')
          }
        }
      } catch (error) {
        console.error('Failed to load existing feedback:', error)
      } finally {
        setLoadingExisting(false)
      }
    }

    void loadExistingFeedback()
  }, [generationId, token, generationStatus])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  // Show thank you message briefly after new submission, then transition to toast.
  // This is an intentional animation sequence: thank you (3s) -> toast notification.
  // The chained state updates are necessary for the timing sequence.
  /* eslint-disable react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-event-handler */
  useEffect(() => {
    if (justSubmitted) {
      setShowThankYou(true)
      // Hide toast while showing thank you message
      setShowToast(false)
      const timer = setTimeout(() => {
        setShowThankYou(false)
        setJustSubmitted(false) // Reset after showing thank you
        // Show toast after thank you message disappears, using ref as backup if state was lost
        const msgToShow = toastMessage?.trim() || pendingToastMessage.current?.trim()
        if (msgToShow) {
          setToastMessage(msgToShow) // Ensure state is set
          setShowToast(true)
        }
      }, 3000) // Show thank you for 3 seconds
      return () => clearTimeout(timer)
    }
  }, [justSubmitted, toastMessage])
  /* eslint-enable react-you-might-not-need-an-effect/no-chain-state-updates, react-you-might-not-need-an-effect/no-event-handler */

  // Track scroll position for scroll indicators
  useEffect(() => {
    const form = formRef.current
    if (!form || !showForm) {
      setCanScrollUp(false)
      setCanScrollDown(false)
      return
    }

    const checkScrollability = () => {
      const { scrollTop, scrollHeight, clientHeight } = form
      const isScrollable = scrollHeight > clientHeight
      setCanScrollUp(isScrollable && scrollTop > 0)
      setCanScrollDown(isScrollable && scrollTop < scrollHeight - clientHeight - 1)
    }

    // Check initially
    checkScrollability()

    // Check on scroll
    form.addEventListener('scroll', checkScrollability)

    // Check when form content changes
    const resizeObserver = new ResizeObserver(checkScrollability)
    resizeObserver.observe(form)

    return () => {
      form.removeEventListener('scroll', checkScrollability)
      resizeObserver.disconnect()
    }
  }, [showForm, selectedReasons, comment])

  // Only show rating for completed generations
  if (generationStatus !== 'completed') {
    return null
  }

  // Show loading state while checking for existing feedback
  if (loadingExisting) {
    return null // Or a small loading indicator if preferred
  }

  const handleThumbsUp = async () => {
    // If already submitted with thumbs down, switch to thumbs up
    if (submitted && rating === 'down') {
      setShowForm(false)
      setSelectedReasons([])
      setComment('')
    }
    setRating('up')
    setLoading(true)

    try {
      const url = token
        ? `/api/feedback?token=${encodeURIComponent(token)}`
        : '/api/feedback'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'generation',
          rating: 'up',
          context: 'generation',
          generationId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('error'))
      }

      track('generation_rated', {
        generationId,
        rating: 'up',
      })

      const wasAlreadySubmitted = submitted
      setSubmitted(true)
      setJustSubmitted(!wasAlreadySubmitted) // Only show thank you for new submissions, not updates
      const message = wasAlreadySubmitted
        ? t('rating.updated')
        : t('rating.submitted')
      console.log('[GenerationRating] Setting toast message (thumbs up):', {
        wasAlreadySubmitted,
        message,
        messageLength: message?.length,
        messageType: typeof message
      })
      // Set the translated message
      setToastMessage(message)
      pendingToastMessage.current = message // Store in ref as backup
      setToastType('success')
      // Only show toast immediately if not showing thank you message (i.e., if updating existing feedback)
      if (wasAlreadySubmitted) {
        setShowToast(true)
      } else {
        // For new submissions, toast will show after thank you message disappears (handled in useEffect)
        setShowToast(false)
      }
    } catch {
      const errorMsg = t('error')
      setToastMessage(errorMsg)
      pendingToastMessage.current = errorMsg
      setToastType('error')
      setShowToast(true)
      setRating('')
    } finally {
      setLoading(false)
    }
  }

  const handleThumbsDown = () => {
    // If already submitted with thumbs up, switch to thumbs down and show form
    // Otherwise just show form
    if (submitted && rating === 'up') {
      setRating('down')
      setShowForm(true)
      // Clear previous reasons/comment when switching
      setSelectedReasons([])
      setComment('')
    } else {
      setRating('down')
      setShowForm(true)
    }
  }

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    )
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: at least one reason or comment required
    if (selectedReasons.length === 0 && !comment.trim()) {
      setToastMessage(t('generation.feedbackRequired'))
      setToastType('error')
      setShowToast(true)
      return
    }

    setLoading(true)

    try {
      const url = token
        ? `/api/feedback?token=${encodeURIComponent(token)}`
        : '/api/feedback'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'generation',
          rating: 'down',
          context: 'generation',
          generationId,
          options: selectedReasons.length > 0 ? selectedReasons : undefined,
          comment: comment.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('error'))
      }

      track('generation_rated', {
        generationId,
        rating: 'down',
        has_reasons: selectedReasons.length > 0,
        has_comment: !!comment.trim(),
      })

      const wasAlreadySubmitted = submitted
      setSubmitted(true)
      setJustSubmitted(!wasAlreadySubmitted) // Only show thank you for new submissions, not updates
      setShowForm(false)
      const message = wasAlreadySubmitted
        ? t('rating.updated')
        : t('rating.submitted')
      console.log('[GenerationRating] Setting toast message (thumbs down):', {
        wasAlreadySubmitted,
        message,
        messageLength: message?.length,
        messageType: typeof message
      })
      // Set the translated message
      setToastMessage(message)
      pendingToastMessage.current = message // Store in ref as backup
      setToastType('success')
      // Only show toast immediately if not showing thank you message (i.e., if updating existing feedback)
      if (wasAlreadySubmitted) {
        setShowToast(true)
      } else {
        // For new submissions, toast will show after thank you message disappears (handled in useEffect)
        setShowToast(false)
      }
    } catch {
      const errorMsg = t('error')
      setToastMessage(errorMsg)
      pendingToastMessage.current = errorMsg
      setToastType('error')
      setShowToast(true)
    } finally {
      setLoading(false)
    }
  }

  // Show thank you message briefly, then show persistent rating state
  if (showThankYou && justSubmitted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200/50 text-sm text-brand-secondary-hover font-medium">
        <span>✓</span>
        <span>{t('rating.thankYou')}</span>
      </div>
    )
  }

  const closeForm = () => {
    setShowForm(false)
    setRating('')
    setSelectedReasons([])
    setComment('')
  }

  const detailedFeedbackForm = (
    <div
      className="fixed inset-0 z-[10000] p-4 flex items-center justify-center"
      onClick={closeForm}
    >
      <div className="absolute inset-0 bg-black/20" />
      <form
        ref={formRef}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmitFeedback}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-sm rounded-lg p-4 space-y-3 shadow-xl border border-gray-200 max-h-[85vh] overflow-y-auto"
      >
        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">
            {t('generation.whatsWrong')}
          </p>
          <p className="text-xs text-gray-600 mb-3">
            {t('generation.helpImprove')}
          </p>

          <div className="space-y-2">
            {FEEDBACK_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(reason)}
                  onChange={() => handleReasonToggle(reason)}
                  className="mr-2"
                />
                <span>{t(`generation.reasons.${reason}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="generation-comment" className="block text-sm font-medium text-gray-700 mb-1">
            {t('form.comment')} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="generation-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none placeholder:text-gray-500"
            placeholder={t('generation.commentPlaceholder')}
            required
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeForm}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            {t('form.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('submitting') : t('form.submit')}
          </button>
        </div>

        {/* Scroll indicators */}
        {canScrollUp && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <ChevronUp className="w-4 h-4 text-gray-400 animate-pulse" />
          </div>
        )}
        {canScrollDown && (
          <div className="absolute bottom-2 right-2 pointer-events-none">
            <ChevronDown className="w-4 h-4 text-gray-400 animate-pulse" />
          </div>
        )}
      </form>
    </div>
  )

  return (
    <>
      <div className="flex items-center gap-1" ref={feedbackControlRef}>
        {!showForm ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleThumbsUp()
              }}
              disabled={loading}
              className={`p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200/50 transition-all ${(submitted && rating === 'up') || rating === 'up'
                ? 'text-brand-secondary-hover bg-brand-secondary-light/90'
                : 'text-gray-600 hover:text-brand-secondary-hover hover:bg-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={t('rating.up')}
              title={t('rating.up')}
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleThumbsDown()
              }}
              disabled={loading}
              className={`p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200/50 transition-all ${(submitted && rating === 'down') || rating === 'down'
                ? 'text-red-600 bg-red-50/90'
                : 'text-gray-600 hover:text-red-600 hover:bg-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={t('rating.down')}
              title={t('rating.down')}
            >
              <ThumbsDown className="w-5 h-5" />
            </button>
          </>
        ) : null}
      </div>

      {showForm
        ? (typeof document === 'undefined' ? detailedFeedbackForm : createPortal(detailedFeedbackForm, document.body))
        : null}

      {/* Toast Notification */}
      {showToast && toastMessage && toastMessage.trim() ? (
        <Toast
          message={toastMessage.trim()}
          type={toastType}
          anchorRef={photoContainerRef || feedbackControlRef} // Use photo ref if available
          onDismiss={() => {
            setShowToast(false)
            setToastMessage('')
          }}
        />
      ) : showToast ? (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="rounded-md shadow-lg px-4 py-3 text-sm bg-yellow-500 text-black">
            Toast triggered but message is: &quot;{toastMessage}&quot; (length: {toastMessage?.length || 0})
          </div>
        </div>
      ) : null}
    </>
  )
}
