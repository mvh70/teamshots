'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'

interface StripeNoticeProps {
  className?: string
  autoHideMs?: number
  clearParams?: boolean
  showWhenSuccessPresent?: boolean
}

export default function StripeNotice({ className, autoHideMs = 5000, clearParams = true, showWhenSuccessPresent = false }: StripeNoticeProps) {
  const searchParams = useSearchParams()
  const tDashboard = useTranslations('app.dashboard')
  const tPricing = useTranslations('pricing')
  
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [type, setType] = useState<'success' | 'canceled' | 'error'>('success')

  const params = useMemo(() => {
    return {
      success: searchParams.get('success') === 'true',
      canceled: searchParams.get('canceled') === 'true',
      error: searchParams.get('error') === 'true',
      type: searchParams.get('type') || undefined,
      errorMessage: searchParams.get('message') || undefined,
    }
  }, [searchParams])

  useEffect(() => {
    // Handle canceled state
    if (params.canceled && (!params.success || showWhenSuccessPresent)) {
      setMessage(tPricing('checkoutCanceled', { default: 'Checkout canceled. No charges were made.' }))
      setType('canceled')
      setVisible(true)
      
      const to = window.setTimeout(() => setVisible(false), autoHideMs)
      return () => window.clearTimeout(to)
    }

    // Handle error state
    if (params.error) {
      const errorMsg = params.errorMessage || tPricing('checkoutError', { default: 'Something went wrong. Please try again.' })
      setMessage(errorMsg)
      setType('error')
      setVisible(true)
      
      if (clearParams) {
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('error')
        newUrl.searchParams.delete('message')
        window.history.replaceState({}, '', newUrl.toString())
      }
      
      const to = window.setTimeout(() => setVisible(false), autoHideMs)
      return () => window.clearTimeout(to)
    }

    // Handle success state
    if (params.success) {
      let msg = tDashboard('successMessages.default', { default: 'Payment completed successfully.' })
      switch (params.type) {
        case 'individual_success':
          msg = tDashboard('successMessages.individual', { 
            default: 'Your purchase was successful! Credits added to your account.', 
            photos: calculatePhotosFromCredits(PRICING_CONFIG.tryItForFree.credits)
          })
          break
        case 'individual_success':
          msg = tDashboard('successMessages.individual', { 
            default: 'Subscription activated successfully.', 
            photos: calculatePhotosFromCredits(PRICING_CONFIG.individual.credits)
          })
          break
        case 'pro_small_success':
          msg = tDashboard('successMessages.pro', { 
            default: 'Pro subscription activated successfully.', 
            photos: calculatePhotosFromCredits(PRICING_CONFIG.proSmall.credits)
          })
          break
        case 'pro_large_success':
          msg = tDashboard('successMessages.pro', { 
            default: 'Pro subscription activated successfully.', 
            photos: calculatePhotosFromCredits(PRICING_CONFIG.proLarge.credits)
          })
          break
        case 'pro_success':
          // Legacy support - default to proSmall
          msg = tDashboard('successMessages.pro', { 
            default: 'Pro subscription activated successfully.', 
            photos: calculatePhotosFromCredits(PRICING_CONFIG.proSmall.credits)
          })
          break
        case 'top_up_success':
          msg = tDashboard('successMessages.topUp', { default: 'Credit top-up completed successfully! Your credits have been added to your account.' })
          break
        default:
          msg = tDashboard('successMessages.default', { default: 'Payment completed successfully.' })
      }

      setMessage(msg)
      setType('success')
      setVisible(true)

      if (clearParams) {
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('success')
        newUrl.searchParams.delete('type')
        newUrl.searchParams.delete('tier')
        newUrl.searchParams.delete('period')
        window.history.replaceState({}, '', newUrl.toString())
      }

      const to = window.setTimeout(() => setVisible(false), autoHideMs)
      return () => window.clearTimeout(to)
    }
  }, [params, tDashboard, tPricing, autoHideMs, clearParams, showWhenSuccessPresent])

  if (!visible) return null

  // Determine styling based on type
  const styles = {
    success: {
      container: 'bg-brand-secondary-light border-brand-secondary-lighter',
      icon: 'text-brand-secondary',
      text: 'text-brand-secondary-text-light',
      iconComponent: CheckIcon,
    },
    canceled: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      text: 'text-yellow-800',
      iconComponent: ExclamationTriangleIcon,
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-400',
      text: 'text-red-800',
      iconComponent: ExclamationTriangleIcon,
    },
  }

  const currentStyles = styles[type]
  const Icon = currentStyles.iconComponent

  return (
    <div className={`mb-6 border rounded-lg p-4 ${currentStyles.container} ${className || ''}`}>
      <div className="flex">
        <Icon className={`h-5 w-5 ${currentStyles.icon} mr-2 mt-0.5`} />
        <p className={currentStyles.text}>{message}</p>
      </div>
    </div>
  )
}

