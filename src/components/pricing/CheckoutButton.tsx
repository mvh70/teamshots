'use client'

import { useState } from 'react'
import { BRAND_CONFIG } from '@/config/brand'

type CheckoutType = 'subscription' | 'try_once' | 'top_up'

interface CheckoutButtonProps {
  label: string
  subLabel?: string
  loadingLabel?: string
  type: CheckoutType
  priceId?: string
  metadata?: Record<string, unknown>
  returnUrl?: string
  className?: string
  fullWidth?: boolean
  useBrandCtaColors?: boolean
  disabled?: boolean
  onError?: (message: string) => void
}

export default function CheckoutButton({
  label,
  subLabel,
  loadingLabel,
  type,
  priceId,
  metadata,
  returnUrl,
  className = '',
  fullWidth = true,
  useBrandCtaColors = true,
  disabled,
  onError,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, priceId, metadata, returnUrl: returnUrl || (typeof window !== 'undefined' ? window.location.href : undefined) })
      })
      const data = (await res.json()) as { checkoutUrl?: string; error?: string }
      if (!res.ok || !data.checkoutUrl) {
        const msg = data.error || 'Checkout creation failed'
        if (onError) onError(msg)
        setLoading(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (onError) onError(msg)
      setLoading(false)
    }
  }

  const baseClasses = `${fullWidth ? 'w-full ' : ''}inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${className}`
  const brandStyle: React.CSSProperties | undefined = useBrandCtaColors
    ? { backgroundColor: BRAND_CONFIG.colors.cta }
    : undefined

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`${baseClasses} ${loading || disabled ? 'opacity-60 cursor-not-allowed' : ''} ${useBrandCtaColors ? 'text-white' : ''}`}
      style={brandStyle}
      onMouseEnter={(e) => {
        if (!useBrandCtaColors || loading || disabled) return
        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
      }}
      onMouseLeave={(e) => {
        if (!useBrandCtaColors || loading || disabled) return
        e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
      }}
    >
      {loading ? (
        loadingLabel || 'Loading...'
      ) : (
        <div className="flex flex-col items-center leading-tight">
          <span>{label}</span>
          {subLabel && <span className="text-[11px] opacity-90 mt-0.5">{subLabel}</span>}
        </div>
      )}
    </button>
  )
}


