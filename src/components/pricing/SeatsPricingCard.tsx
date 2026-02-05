'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckoutButton } from '@/components/ui';
import { PRICING_CONFIG } from '@/config/pricing';
import PromoCodeInput, { type PromoCodeDiscount } from './PromoCodeInput';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

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

/**
 * Calculate the breakdown of seats across pricing tiers
 */
function getGraduatedBreakdown(seats: number): Array<{
  tierMin: number;
  tierMax: number | null;
  seatsInTier: number;
  pricePerSeat: number;
  subtotal: number;
}> {
  if (seats < MIN_SEATS) return [];

  const breakdown: Array<{
    tierMin: number;
    tierMax: number | null;
    seatsInTier: number;
    pricePerSeat: number;
    subtotal: number;
  }> = [];

  let remaining = seats;

  // Process tiers from smallest to largest (reverse config order)
  const tiersAscending = [...PRICING_CONFIG.seats.graduatedTiers].reverse();

  for (const tier of tiersAscending) {
    if (remaining <= 0) break;

    const tierCapacity = tier.max === Infinity
      ? Infinity
      : tier.max - tier.min + 1;

    const seatsInTier = Math.min(remaining, tierCapacity);

    if (seatsInTier > 0) {
      breakdown.push({
        tierMin: tier.min,
        tierMax: tier.max === Infinity ? null : tier.max,
        seatsInTier,
        pricePerSeat: tier.pricePerSeat,
        subtotal: seatsInTier * tier.pricePerSeat,
      });
      remaining -= seatsInTier;
    }
  }

  return breakdown;
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
  /** Show the tiered pricing breakdown explanation */
  showPricingBreakdown?: boolean;
}

export default function SeatsPricingCard({
  unauth = false,
  returnUrl,
  className = '',
  initialSeats = 10,
  currentSeats,
  showPricingBreakdown = true
}: SeatsPricingCardProps) {
  const t = useTranslations('pricing');
  const { track } = useAnalytics();
  // Keep breakdown collapsed by default to reduce cognitive load
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  
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

  const savings = getSavings(validatedSeats);

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
      {/* One-time payment badge - key differentiator */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
        <span className="bg-green-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md">
          {t('seats.oneTimePayment')}
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
          {/* Slider range labels */}
          <div className="flex justify-between mb-2 text-xs text-gray-500 px-1">
            <span>{minSeats}</span>
            <span>200+</span>
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

      {/* Pricing Display - Clean and focused */}
      <div className="text-center mb-6">
        {isTopUpMode && currentSeats > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            {t('seats.currentToNew', { current: currentSeats, total: validatedSeats })}
          </div>
        )}

        {/* Simple price display */}
        <div className="text-4xl font-bold text-gray-900 mb-1">
          ${displayPricePerSeat.toFixed(2)}
        </div>
        <div className="text-lg font-medium text-gray-500 mb-3">{t('seats.perSeat')}</div>

        {/* Total */}
        <div className="text-sm text-gray-600">
          {isTopUpMode ? (
            <>{t('seats.totalForSeats', { amount: (topUpTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count: additionalSeats })}</>
          ) : (
            <span>
              {t('seats.totalLabel', { amount: total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count: validatedSeats })}
            </span>
          )}
        </div>
        {/* Volume savings hint - only show when meaningful */}
        {savings > 10 && !isTopUpMode && (
          <div className="text-sm text-green-600 font-medium mt-1">
            {t('seats.saveDollar', { amount: savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
          </div>
        )}
      </div>

      {/* Tiered Pricing Breakdown - simplified, only for power users */}
      {showPricingBreakdown && validatedSeats >= 5 && (
        <div className="mb-6">
          <button
            onClick={() => setBreakdownExpanded(!breakdownExpanded)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
            aria-expanded={breakdownExpanded}
          >
            <span>{t('seats.pricingBreakdown.title')}</span>
            {breakdownExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>

          {breakdownExpanded && (
            <div className="mt-2 p-4 bg-gray-50 rounded-xl text-sm">
              {/* Simple tier reference */}
              <div className="space-y-2">
                {[...PRICING_CONFIG.seats.graduatedTiers].reverse().map((tier, idx) => (
                  <div key={idx} className="flex justify-between text-gray-600">
                    <span>
                      {tier.max === Infinity
                        ? t('seats.pricingBreakdown.tierLabelInfinity', { min: tier.min })
                        : t('seats.pricingBreakdown.tierLabel', { min: tier.min, max: tier.max })
                      }
                    </span>
                    <span className="font-semibold">${tier.pricePerSeat.toFixed(2)}{t('seats.pricingBreakdown.perPerson')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key value props - reduced to essentials */}
      <div className="flex items-center justify-center gap-4 mb-6 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          10 photos each
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Never expires
        </span>
      </div>

      {/* CTA Button - Switch to "Book a Demo" for enterprise (100+ seats) */}
      {validatedSeats >= 100 ? (
        <a
          href="https://calendly.com/teamshotspro/demo"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-xl shadow-lg transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t('seats.bookDemo')}
        </a>
      ) : (
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
      )}
    </div>
  );
}

