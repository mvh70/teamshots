'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckoutButton } from '@/components/ui';
import { PRICING_CONFIG } from '@/config/pricing';
import PromoCodeInput, { type PromoCodeDiscount } from './PromoCodeInput';

// Use graduated pricing from config
const MIN_SEATS = PRICING_CONFIG.seats.minSeats;

function calculateTotal(seats: number): number {
  return PRICING_CONFIG.seats.calculateTotal(seats);
}

function getSavings(seats: number): number {
  if (seats < MIN_SEATS) return 0;
  const baseTierPrice = PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat;
  const actualTotal = calculateTotal(seats);
  const baseTotal = seats * baseTierPrice;
  return baseTotal - actualTotal;
}

interface SeatsPricingCardProps {
  /** For authenticated users (upgrade page) vs unauthenticated (landing) */
  unauth?: boolean;
  /** Optional return URL after checkout */
  returnUrl?: string;
  /** Custom class name */
  className?: string;
  /** Initial number of seats */
  initialSeats?: number;
  /** Current seats owned (for top-up mode) - sets minimum and shows difference */
  currentSeats?: number;
}

export default function SeatsPricingCard({ 
  unauth = false, 
  returnUrl, 
  className = '',
  initialSeats = 10,
  currentSeats 
}: SeatsPricingCardProps) {
  const t = useTranslations('pricing');
  
  // Calculate minimum seats based on mode
  const isTopUpMode = currentSeats !== undefined && currentSeats > 0;
  const minSeats = isTopUpMode ? currentSeats : PRICING_CONFIG.seats.minSeats;
  
  // For top-up mode, start with current seats + 1, otherwise use initialSeats
  const startingSeats = isTopUpMode ? Math.max(currentSeats + 1, initialSeats) : initialSeats;
  const [seats, setSeats] = useState(startingSeats);

  // Promo code state
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<PromoCodeDiscount | null>(null);
  const [stripePromoCodeId, setStripePromoCodeId] = useState<string | undefined>(undefined);
  
  // Update seats when currentSeats changes (important for when API data loads)
  useEffect(() => {
    if (isTopUpMode && currentSeats) {
      // If current seats changed and is now higher than selected seats, update to current + 1
      if (seats <= currentSeats) {
        setSeats(currentSeats + 1);
      }
    }
  }, [currentSeats, isTopUpMode, seats, minSeats]);

  // Clear promo code when seats change (price changes)
  useEffect(() => {
    if (appliedPromoCode) {
      setAppliedPromoCode(null);
      setPromoDiscount(null);
      setStripePromoCodeId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  const handlePromoCodeApply = (code: string, discount: PromoCodeDiscount, promoCodeId?: string) => {
    setAppliedPromoCode(code);
    setPromoDiscount(discount);
    setStripePromoCodeId(promoCodeId);
  };

  const handlePromoCodeClear = () => {
    setAppliedPromoCode(null);
    setPromoDiscount(null);
    setStripePromoCodeId(undefined);
  };
  
  // Calculate values - ensure seats never goes below minimum
  const validatedSeats = Math.max(seats, minSeats);
  const additionalSeats = isTopUpMode ? validatedSeats - currentSeats : validatedSeats;

  // For graduated pricing, calculate totals first
  const total = calculateTotal(validatedSeats);
  const topUpTotal = isTopUpMode ? calculateTotal(validatedSeats) - calculateTotal(currentSeats) : total;

  // Calculate average price per seat for display (more accurate for graduated pricing)
  // Use discounted price if promo code is applied
  const effectiveTotal = promoDiscount ? promoDiscount.finalAmount : (isTopUpMode ? topUpTotal : total);
  const seatsForAverage = isTopUpMode ? additionalSeats : validatedSeats;
  const averagePricePerSeat = seatsForAverage > 0 ? effectiveTotal / seatsForAverage : 0;

  const savings = getSavings(validatedSeats);
  const totalPhotos = validatedSeats * (PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration);

  return (
    <div className={`bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-4 border-brand-primary relative ${className}`}>
      {/* Popular Badge */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
        <span className="bg-brand-primary text-white px-6 py-2 rounded-full text-sm font-bold shadow-md">
          {t('mostPopular')}
        </span>
      </div>

      {/* Seats Selector */}
      <div className="mb-6 pt-4">
      <div className="text-center mb-6">
        <div className="text-5xl font-bold text-brand-primary mb-2">
          {validatedSeats} {validatedSeats === 1 ? t('seats.seat') : t('seats.seats')}
        </div>
        <div className="text-sm text-gray-600">{t('seats.selectSeats')}</div>
      </div>

        {/* Slider */}
        <input
          type="range"
          min={minSeats}
          max="200"
          step="1"
          value={validatedSeats}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            // Enforce minimum
            const clampedValue = Math.max(newValue, minSeats);
            setSeats(clampedValue);
          }}
          className="w-full h-3 bg-indigo-100 rounded-lg appearance-none cursor-pointer slider-thumb mb-3"
          style={{
            background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${((validatedSeats - minSeats) / (200 - minSeats)) * 100}%, #E0E7FF ${((validatedSeats - minSeats) / (200 - minSeats)) * 100}%, #E0E7FF 100%)`
          }}
        />

        {/* Quick select buttons - aligned with volume tier breakpoints */}
        <div className="flex gap-2 flex-wrap justify-center">
          {[2, 5, 10, 25, 100, 200]
            .filter(count => count > minSeats)
            .map((count) => (
              <button
                key={count}
                onClick={() => setSeats(count)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  validatedSeats === count
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-indigo-100'
                }`}
              >
                {count}
              </button>
            ))}
        </div>
      </div>

      {/* Pricing Display */}
      <div className="text-center mb-6">
        <div className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-3">
          One-time payment • No subscription
        </div>
        {isTopUpMode && currentSeats > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            Current: {currentSeats} {currentSeats === 1 ? 'seat' : 'seats'} → New total: {validatedSeats} {validatedSeats === 1 ? 'seat' : 'seats'}
          </div>
        )}

        {/* Price per seat - prominent */}
        <div className="text-4xl font-bold text-gray-900 mb-1">
          ${averagePricePerSeat.toFixed(2)}
          <span className="text-lg font-medium text-gray-500"> {t('seats.perSeat')}</span>
        </div>

        {/* Total price - secondary */}
        {promoDiscount ? (
          <div className="mb-2">
            <span className="text-lg text-gray-400 line-through mr-2">
              ${(isTopUpMode ? topUpTotal : total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-lg font-semibold text-green-600">
              ${promoDiscount.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
            </span>
            <div className="text-sm font-semibold text-green-600">
              You save ${promoDiscount.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {promoDiscount.type === 'percentage' && ` (${promoDiscount.value}% off)`}
            </div>
          </div>
        ) : (
          <div className="text-lg text-gray-600 mb-2">
            {isTopUpMode ? (
              <>${(topUpTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total for {additionalSeats} {additionalSeats === 1 ? 'seat' : 'seats'}</>
            ) : (
              <>
                ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                {savings > 0 && (
                  <span className="text-green-600 font-semibold"> · Save ${savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {['photosPerSeat', 'teamManagement', 'fullCustomization', 'creditsNeverExpire', 'flexibleTeamSize'].map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <svg className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-600">{t(`seats.features.${feature}`)}</span>
          </li>
        ))}
      </ul>

      {/* Promo Code Input */}
      <PromoCodeInput
        purchaseType="seats"
        originalAmount={isTopUpMode ? topUpTotal : total}
        seats={isTopUpMode ? additionalSeats : validatedSeats}
        onApply={handlePromoCodeApply}
        onClear={handlePromoCodeClear}
        isApplied={!!appliedPromoCode}
        appliedCode={appliedPromoCode || ''}
        className="mb-4"
      />

      {/* CTA Button */}
      <CheckoutButton
        type="seats"
        quantity={isTopUpMode ? additionalSeats : validatedSeats}
        unauth={unauth}
        metadata={{
          planTier: 'pro',
          planPeriod: 'seats',
          seats: (isTopUpMode ? additionalSeats : validatedSeats).toString(),
          isTopUp: isTopUpMode ? 'true' : 'false',
          currentSeats: currentSeats?.toString() || '0',
        }}
        returnUrl={returnUrl}
        promoCode={appliedPromoCode || undefined}
        stripePromoCodeId={stripePromoCodeId}
        useBrandCtaColors
        className="w-full"
      >
        {isTopUpMode
          ? `Buy ${additionalSeats} ${additionalSeats === 1 ? 'seat' : 'seats'}`
          : `Buy ${validatedSeats} ${validatedSeats === 1 ? 'seat' : 'seats'}`
        }
      </CheckoutButton>
    </div>
  );
}

