'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckoutButton } from '@/components/ui';
import { PRICING_CONFIG } from '@/config/pricing';

// Use graduated pricing from config
const MIN_SEATS = PRICING_CONFIG.seats.minSeats;

function getTierPrice(seatCount: number): number {
  if (seatCount < MIN_SEATS) return 0;
  const tier = PRICING_CONFIG.seats.graduatedTiers.find(
    t => seatCount >= t.min && seatCount <= t.max
  );
  return tier?.pricePerSeat ?? PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1].pricePerSeat;
}

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
  
  // Update seats when currentSeats changes (important for when API data loads)
  useEffect(() => {
    if (isTopUpMode && currentSeats) {
      // If current seats changed and is now higher than selected seats, update to current + 1
      if (seats <= currentSeats) {
        setSeats(currentSeats + 1);
      }
    }
  }, [currentSeats, isTopUpMode, seats, minSeats]);
  
  // Calculate values - ensure seats never goes below minimum
  const validatedSeats = Math.max(seats, minSeats);
  const additionalSeats = isTopUpMode ? validatedSeats - currentSeats : validatedSeats;
  const pricePerSeat = getTierPrice(validatedSeats);
  const total = calculateTotal(validatedSeats);
  const savings = getSavings(validatedSeats);
  const totalPhotos = validatedSeats * (PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration);
  
  // For top-up mode, calculate the cost of just the additional seats
  const topUpTotal = isTopUpMode ? calculateTotal(validatedSeats) - calculateTotal(currentSeats) : total;

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
          max="1000"
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
            background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${((validatedSeats - minSeats) / (1000 - minSeats)) * 100}%, #E0E7FF ${((validatedSeats - minSeats) / (1000 - minSeats)) * 100}%, #E0E7FF 100%)`
          }}
        />

        {/* Quick select buttons - aligned with volume tier breakpoints */}
        <div className="flex gap-2 flex-wrap justify-center">
          {[2, 5, 25, 100, 500, 1000]
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
      <div className="text-center mb-6 pb-6 border-b border-gray-100">
        <div className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold mb-3">
          One-time payment • No subscription
        </div>
        {isTopUpMode && currentSeats > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            Current: {currentSeats} {currentSeats === 1 ? 'seat' : 'seats'} → New total: {validatedSeats} {validatedSeats === 1 ? 'seat' : 'seats'}
          </div>
        )}
        <div className="text-4xl font-bold text-gray-900 mb-2">
          ${(isTopUpMode ? topUpTotal : total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-gray-600 mb-2">
          ${pricePerSeat.toFixed(2)} {t('seats.perSeat')}
          {isTopUpMode && additionalSeats > 0 && (
            <span className="ml-1">× {additionalSeats} {additionalSeats === 1 ? 'seat' : 'seats'}</span>
          )}
        </div>
        {savings > 0 && (
          <div className="text-sm font-semibold text-green-600">
            {t('seats.savings')}: ${savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
        <div className="text-sm text-brand-primary font-semibold mt-2">
          {isTopUpMode 
            ? `+${(additionalSeats * (PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration)).toLocaleString('en-US')} photos`
            : `${totalPhotos.toLocaleString('en-US')} photos in total`
          }
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {['photosPerSeat', 'professionalQuality', 'teamManagement', 'fastDelivery'].map((feature) => (
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
        priceId={PRICING_CONFIG.seats.stripePriceId}
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

