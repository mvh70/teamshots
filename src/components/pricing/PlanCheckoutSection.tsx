'use client'

import { useState } from 'react'
import { CheckoutButton } from '@/components/ui'
import PromoCodeInput, { type PromoCodeDiscount } from './PromoCodeInput'

interface PlanCheckoutSectionProps {
  planId: string
  priceId: string
  originalAmount: number
  planTier: string
  planPeriod: string
  ctaText: string
  isPopular?: boolean
  className?: string
}

export default function PlanCheckoutSection({
  planId,
  priceId,
  originalAmount,
  planTier,
  planPeriod,
  ctaText,
  isPopular = false,
  className = '',
}: PlanCheckoutSectionProps) {
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)
  const [promoDiscount, setPromoDiscount] = useState<PromoCodeDiscount | null>(null)
  const [stripePromoCodeId, setStripePromoCodeId] = useState<string | undefined>(undefined)

  const handlePromoCodeApply = (code: string, discount: PromoCodeDiscount, promoCodeId?: string) => {
    setAppliedPromoCode(code)
    setPromoDiscount(discount)
    setStripePromoCodeId(promoCodeId)
  }

  const handlePromoCodeClear = () => {
    setAppliedPromoCode(null)
    setPromoDiscount(null)
    setStripePromoCodeId(undefined)
  }

  // Unified button styling for CheckoutButton - matches PricingCard button styling
  const baseButtonClasses = '!rounded-xl lg:!rounded-2xl w-full text-center !px-4 !py-3 lg:!px-6 lg:!py-4 min-h-[3.5rem] lg:min-h-[4rem] !font-bold !text-sm lg:!text-base transition-all duration-300 flex items-center justify-center'
  const buttonVariantClasses = isPopular
    ? ''
    : 'bg-bg-gray-50 text-text-dark hover:bg-gradient-to-r hover:from-brand-primary-light hover:to-brand-primary-lighter hover:text-brand-primary border-2 border-transparent hover:border-brand-primary-lighter/50'

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Price display when promo code is applied */}
      {promoDiscount && (
        <div className="text-center py-2 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-gray-500 line-through">
            ${originalAmount.toFixed(2)}
          </div>
          <div className="text-lg font-bold text-green-600">
            ${promoDiscount.finalAmount.toFixed(2)}
          </div>
          <div className="text-xs text-green-600">
            Save ${promoDiscount.discountAmount.toFixed(2)}
            {promoDiscount.type === 'percentage' && ` (${promoDiscount.value}% off)`}
          </div>
        </div>
      )}

      {/* Promo Code Input */}
      <PromoCodeInput
        purchaseType="plan"
        originalAmount={originalAmount}
        onApply={handlePromoCodeApply}
        onClear={handlePromoCodeClear}
        isApplied={!!appliedPromoCode}
        appliedCode={appliedPromoCode || ''}
      />

      {/* Checkout Button */}
      <CheckoutButton
        type="plan"
        priceId={priceId}
        unauth={true}
        metadata={{
          planTier,
          planPeriod,
        }}
        promoCode={appliedPromoCode || undefined}
        stripePromoCodeId={stripePromoCodeId}
        useBrandCtaColors={isPopular}
        className={`${baseButtonClasses} ${buttonVariantClasses}`.trim()}
      >
        {ctaText}
      </CheckoutButton>
    </div>
  )
}
