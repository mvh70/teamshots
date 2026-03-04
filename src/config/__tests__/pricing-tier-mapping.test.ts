import { getPricingTier, getRegenerationsForPlan } from '@/config/pricing'

describe('pricing tier translator', () => {
  it('maps required plan combinations to expected pricing tiers', () => {
    expect(getPricingTier('individual', 'small')).toBe('individual')
    expect(getPricingTier('individual', 'large')).toBe('vip')
    expect(getPricingTier('pro', 'seats')).toBe('seats')
    expect(getPricingTier('individual', 'free')).toBe('free')
  })

  it('returns expected regeneration counts for required combinations', () => {
    expect(getRegenerationsForPlan('individual', 'small')).toBe(1)
    expect(getRegenerationsForPlan('individual', 'large')).toBe(3)
    expect(getRegenerationsForPlan('pro', 'seats')).toBe(2)
    expect(getRegenerationsForPlan('individual', 'free')).toBe(1)
  })
})
