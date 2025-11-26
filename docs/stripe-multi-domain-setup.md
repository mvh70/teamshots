# Stripe Multi-Domain Webhook Setup

Since both domains share the same Stripe account, you have two options:

## Option 1: Single Webhook (Recommended)

Use **one webhook endpoint** that both domains can receive. Since both domains point to the same deployment, the webhook will work regardless of which domain the customer used.

**Configuration:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://teamshotspro.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`, etc.


https://www.teamshotspro.com/api/stripe/webhook
The webhook will work because:
- Both domains serve the same app
- The `success_url` and `cancel_url` in checkout use the dynamic domain detection
- Stripe doesn't care which domain you use for the webhook endpoint

## Option 2: Multiple Webhooks (More Complex)

If you want separate tracking per domain, create two webhooks:

1. `https://teamshotspro.com/api/stripe/webhook` 
2. `https://photoshotspro.com/api/stripe/webhook`

**Note:** Both would trigger for the same events, potentially causing duplicate processing. Only use this if you need domain-specific webhook logic.

## Checkout Flow

The checkout already handles multi-domain correctly:
- `success_url` uses the domain from the request that initiated checkout
- `cancel_url` uses the domain from the request that initiated checkout
- Customer returns to the same domain they started from

## Testing

1. Start checkout from `teamshotspro.com` → verify redirect back to `teamshotspro.com`
2. Start checkout from `photoshotspro.com` → verify redirect back to `photoshotspro.com`

