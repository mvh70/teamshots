import { trackCheckoutStarted } from '@/lib/track'

export type CheckoutType = 'subscription' | 'top_up' | 'plan'

interface CreateCheckoutParams {
  type: CheckoutType
  priceId?: string
  metadata?: Record<string, unknown>
  returnUrl?: string
  // Tracking-specific properties
  planTier?: string
  planPeriod?: string
  seatCount?: number
  amount?: number
}

export async function createCheckout(params: CreateCheckoutParams): Promise<string> {
  // Track checkout started before redirecting to Stripe
  trackCheckoutStarted({
    plan_tier: params.planTier || params.metadata?.planTier as string,
    plan_period: params.planPeriod || params.metadata?.planPeriod as string,
    seat_count: params.seatCount || params.metadata?.seats as number,
    amount: params.amount
  })

  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: params.type,
      priceId: params.priceId,
      metadata: params.metadata,
      returnUrl: params.returnUrl || (typeof window !== 'undefined' ? window.location.href : undefined)
    })
  })
  const data = (await res.json()) as { checkoutUrl?: string; error?: string }
  if (!res.ok || !data.checkoutUrl) {
    throw new Error(data.error || 'Checkout creation failed')
  }
  return data.checkoutUrl
}


