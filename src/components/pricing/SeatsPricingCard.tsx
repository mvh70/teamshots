'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckoutButton } from '@/components/ui';
import { PRICING_CONFIG } from '@/config/pricing';
import PromoCodeInput, { type PromoCodeDiscount } from './PromoCodeInput';
import { useAnalytics } from '@/hooks/useAnalytics';

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
  const { track } = useAnalytics();
  
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

  // Get the marginal price per seat at the current tier
  const pricePerSeatAtTier = PRICING_CONFIG.seats.getPricePerSeatAtTier(validatedSeats);
  
  // If promo code is applied, calculate the discounted price per seat
  const displayPricePerSeat = promoDiscount 
    ? promoDiscount.finalAmount / (isTopUpMode ? additionalSeats : validatedSeats)
    : pricePerSeatAtTier;

  // Calculate discount percentage compared to full price (smallest tier)
  const fullPrice = PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat;
  const discountPercentage = fullPrice > 0 ? Math.round(((fullPrice - pricePerSeatAtTier) / fullPrice) * 100) : 0;
  const hasDiscount = discountPercentage > 0 && !promoDiscount;

  const savings = getSavings(validatedSeats);
  const totalPhotos = validatedSeats * (PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration);

  // Track clicks on non-interactive card elements (dead clicks)
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, [role="button"]');
    if (!isInteractive) {
      track('pricing_card_dead_click', {
        card_type: 'seats',
        clicked_element: target.tagName.toLowerCase(),
        clicked_text: target.textContent?.slice(0, 50) || '',
      });
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-4 border-brand-primary relative ${className}`}
      onClick={handleCardClick}
    >
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

        {/* Enhanced Slider */}
        <div className="relative px-2">
          {/* Visual indicator - arrows pointing to slider */}
          <div className="flex justify-center mb-2 text-brand-primary">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-2xl">←</span>
              <span>Drag slider to adjust</span>
              <span className="text-2xl">→</span>
            </div>
          </div>

          <style>{`
            input[type="range"].pricing-slider {
              -webkit-appearance: none;
              appearance: none;
              width: 100%;
              height: 12px;
              border-radius: 12px;
              outline: none;
              background: transparent;
            }
            
            /* Gradient track background */
            input[type="range"].pricing-slider {
              background-image: linear-gradient(to right, #4F46E5 0%, #4F46E5 50%, #E0E7FF 50%, #E0E7FF 100%);
            }
            
            /* Thumb with grip pattern */
            input[type="range"].pricing-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
              border: 6px solid #4F46E5;
              cursor: grab;
              box-shadow: 0 4px 16px rgba(79, 70, 229, 0.5), inset 0 -2px 4px rgba(0,0,0,0.1);
              position: relative;
              transition: all 0.2s ease;
            }
            
            input[type="range"].pricing-slider::-webkit-slider-thumb:hover {
              border-width: 7px;
              box-shadow: 0 6px 24px rgba(79, 70, 229, 0.7), inset 0 -2px 4px rgba(0,0,0,0.1);
              transform: scale(1.05);
            }
            
            input[type="range"].pricing-slider::-webkit-slider-thumb:active {
              cursor: grabbing;
              transform: scale(0.98);
              box-shadow: 0 2px 8px rgba(79, 70, 229, 0.6), inset 0 -2px 4px rgba(0,0,0,0.1);
            }
            
            input[type="range"].pricing-slider::-moz-range-thumb {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
              border: 6px solid #4F46E5;
              cursor: grab;
              box-shadow: 0 4px 16px rgba(79, 70, 229, 0.5), inset 0 -2px 4px rgba(0,0,0,0.1);
              transition: all 0.2s ease;
            }
            
            input[type="range"].pricing-slider::-moz-range-thumb:hover {
              border-width: 7px;
              box-shadow: 0 6px 24px rgba(79, 70, 229, 0.7), inset 0 -2px 4px rgba(0,0,0,0.1);
              transform: scale(1.05);
            }
            
            input[type="range"].pricing-slider::-moz-range-thumb:active {
              cursor: grabbing;
              transform: scale(0.98);
              box-shadow: 0 2px 8px rgba(79, 70, 229, 0.6), inset 0 -2px 4px rgba(0,0,0,0.1);
            }
          `}</style>
          
          <input
            type="range"
            min={minSeats}
            max="200"
            step="1"
            value={validatedSeats}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              const clampedValue = Math.max(newValue, minSeats);
              setSeats(clampedValue);
            }}
            aria-label="Number of team seats"
            className="pricing-slider"
            style={{
              background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${((validatedSeats - minSeats) / (200 - minSeats)) * 100}%, #E0E7FF ${((validatedSeats - minSeats) / (200 - minSeats)) * 100}%, #E0E7FF 100%)`
            }}
          />
        </div>
      </div>

      {/* Pricing Display */}
      <div className="text-center mb-6">
        <div className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-3">
          {t('seats.oneTimePayment')}
        </div>
        {isTopUpMode && currentSeats > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            {t('seats.currentToNew', { current: currentSeats, total: validatedSeats })}
          </div>
        )}

        {/* Price breakdown: $X.XX/person × N = $XXX.XX total */}
        <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
          {hasDiscount && (
            <span className="text-xl text-gray-400 line-through">
              ${fullPrice.toFixed(2)}
            </span>
          )}
          <div className="text-4xl font-bold text-gray-900">
            ${displayPricePerSeat.toFixed(2)}
          </div>
          {hasDiscount && (
            <div className="bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md border-2 border-white whitespace-nowrap">
              {discountPercentage}% OFF
            </div>
          )}
        </div>
        <div className="text-lg font-medium text-gray-500 mb-2">{t('seats.perSeat')}</div>

        {/* Total - de-emphasized */}
        <div className="text-sm text-gray-400 mb-2">
          {isTopUpMode ? (
            <>{t('seats.totalForSeats', { amount: (topUpTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count: additionalSeats })}</>
          ) : (
            <span>
              {t('seats.totalLabel', { amount: total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count: validatedSeats })}
              {savings > 0 && (
                <span className="text-green-600 font-semibold block mt-1">{t('seats.saveDollar', { amount: savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
              )}
            </span>
          )}
        </div>
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
{t('seats.buySeats', { count: isTopUpMode ? additionalSeats : validatedSeats })}
      </CheckoutButton>
    </div>
  );
}

