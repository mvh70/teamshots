export type CheckoutType = 'subscription' | 'top_up' | 'plan'

interface CreateCheckoutParams {
  type: CheckoutType
  priceId?: string
  metadata?: Record<string, unknown>
  returnUrl?: string
}

export async function createCheckout(params: CreateCheckoutParams): Promise<string> {
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


