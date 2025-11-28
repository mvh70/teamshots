'use client'

import React, { useState } from 'react'
import { BRAND_CONFIG } from '@/config/brand'

interface ButtonProps {
  children: React.ReactNode
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void
  variant?: 'primary' | 'secondary' | 'danger' | 'auth' | 'checkout'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  'data-testid'?: string
  // Loading state
  loading?: boolean
  loadingText?: string
  // Layout options
  fullWidth?: boolean
  // Checkout-specific features
  subLabel?: string
  useBrandCtaColors?: boolean
  // Auth-specific features
  authStyle?: boolean
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'sm',
  className = '',
  disabled = false,
  type = 'button',
  'data-testid': testId,
  loading = false,
  loadingText,
  fullWidth = false,
  subLabel,
  useBrandCtaColors = false,
  authStyle = false
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  const baseClasses = `${fullWidth ? 'w-full ' : ''}inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-brand-primary text-white hover:bg-brand-primary-hover focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed'
      case 'secondary':
        return 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed'
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
      case 'auth':
        return 'w-full py-4 px-6 text-white bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 shadow-lg hover:shadow-xl hover:shadow-blue-500/25 transform hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99] font-bold rounded-xl transition-all duration-200 relative overflow-hidden group'
      case 'checkout':
        if (useBrandCtaColors) {
          return 'text-white disabled:opacity-60 disabled:cursor-not-allowed'
        }
        return 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
      default:
        return 'bg-brand-primary text-white hover:bg-brand-primary-hover focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed'
    }
  }

  const variantClasses = getVariantClasses()

  // Auth-style button has fixed layout
  const finalSizeClasses = variant === 'auth' ? 'py-4 px-6' : sizeClasses[size]
  const classes = `${baseClasses} ${finalSizeClasses} ${variantClasses} ${loading || disabled ? 'opacity-60 cursor-not-allowed' : ''} ${authStyle ? 'flex gap-2' : ''} ${className}`

  const brandStyle: React.CSSProperties | undefined = (variant === 'checkout' && useBrandCtaColors)
    ? { backgroundColor: isHovered ? BRAND_CONFIG.colors.ctaHover : BRAND_CONFIG.colors.cta }
    : undefined

  const handleMouseEnter = () => {
    if (variant === 'checkout' && useBrandCtaColors && !loading && !disabled) {
      setIsHovered(true)
    }
  }

  const handleMouseLeave = () => {
    if (variant === 'checkout' && useBrandCtaColors && !loading && !disabled) {
      setIsHovered(false)
    }
  }

  const getButtonContent = () => {
    if (loading) {
      const loadingDisplay = loadingText || (variant === 'auth' ? 'Please wait…' : 'Loading...')

      if (subLabel && variant === 'checkout') {
        return (
          <div className="flex flex-col items-center leading-tight">
            <span>{loadingDisplay}</span>
          </div>
        )
      }

      return loadingDisplay
    }

    if (subLabel && variant === 'checkout') {
      return (
        <div className="flex flex-col items-center leading-tight">
          <span>{children}</span>
          <span className="text-[11px] opacity-90 mt-0.5">{subLabel}</span>
        </div>
      )
    }

    return children
  }

  const shimmerEffect = variant === 'auth' ? (
    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
  ) : null

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      data-testid={testId}
      style={brandStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {shimmerEffect}
      <span className="relative z-10">{getButtonContent()}</span>
    </button>
  )
}

// Specialized button variants for common use cases
export function PrimaryButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props}>{children}</Button>
}

export function SecondaryButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props}>{children}</Button>
}

export function DangerButton({ children, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="danger" {...props}>{children}</Button>
}

export function AuthButton({ children, loading, ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button variant="auth" loading={loading} {...props}>{children}</Button>
}

export function CheckoutButton({
  children,
  // Checkout-specific props
  type,
  priceId,
  metadata,
  returnUrl,
  onError,
  ...props
}: Omit<ButtonProps, 'variant' | 'type'> & {
  type?: 'subscription' | 'top_up' | 'plan'
  priceId?: string
  metadata?: Record<string, unknown>
  returnUrl?: string
  onError?: (message: string) => void
}) {
  const {
    onClick,
    useBrandCtaColors = false,
    fullWidth = true,
    size = 'lg',
    className = '',
    loading: externalLoading = false,
    ...buttonProps
  } = props

  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = externalLoading || internalLoading

  const handleCheckout = async () => {
    if (isLoading || buttonProps.disabled) return
    setInternalLoading(true)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          priceId,
          metadata,
          returnUrl: returnUrl || (typeof window !== 'undefined' ? window.location.href : undefined)
        })
      })
      const data = (await res.json()) as { checkoutUrl?: string; error?: string }
      if (!res.ok || !data.checkoutUrl) {
        const msg = data.error || 'Checkout creation failed'
        if (onError) onError(msg)
        setInternalLoading(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (onError) onError(msg)
      setInternalLoading(false)
    }
  }

  const handleClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    // For top_up, we don't need priceId (price is calculated dynamically)
    // For subscription and plan, we need priceId
    const needsPriceId = type === 'subscription' || type === 'plan'
    if (type && (!needsPriceId || priceId)) {
      // If checkout props provided, handle checkout
      handleCheckout()
    } else {
      // Otherwise use normal onClick
      onClick?.(e)
    }
  }

  const composedClassName = `shadow-lg hover:shadow-xl transition-all duration-300 font-semibold justify-center text-center focus-visible:ring-2 focus-visible:ring-brand-cta focus-visible:ring-offset-2 ${className}`.trim()

  return (
    <Button
      variant="checkout"
      loading={isLoading}
      onClick={handleClick}
      useBrandCtaColors={useBrandCtaColors}
      fullWidth={fullWidth}
      size={size}
      className={composedClassName}
      {...buttonProps}
    >
      {children}
    </Button>
  )
}
