# Stripe seat-based subscriptions with volume discounts

Stripe handles seat-based subscriptions through its **quantity-based billing** system, where the `quantity` parameter on subscription items controls seat count, combined with **tiered or volume pricing** for discount thresholds. The critical architectural decision is choosing between volume pricing (all units at single tier price) versus graduated pricing (each tier billed separately)—this fundamentally changes how mid-cycle seat changes are calculated and billed.

When customers add seats mid-cycle, Stripe generates prorated charges **calculated to the second**, creating credit line items for unused time at the old configuration and debit line items for remaining time at the new configuration. With volume pricing, tier transitions can paradoxically result in net credits when moving to higher tiers due to lower per-unit rates applying to all seats.

## Volume pricing versus graduated pricing determines calculation behavior

Stripe offers two distinct pricing modes controlled by the `tiers_mode` parameter, and understanding the difference is essential for seat-based billing:

**Volume pricing** (`tiers_mode: "volume"`) applies the tier rate matching total quantity to *all* units. With tiers set at $7/seat (1-5 seats), $6.50/seat (6-10 seats), and $6/seat (11+ seats), a customer with **20 seats pays $120** (20 × $6). The critical quirk: total cost can sometimes *decrease* when moving to a higher tier because the lower rate applies universally.

**Graduated pricing** (`tiers_mode: "graduated"`) charges each tier's units at that tier's rate, then sums totals. The same 20-seat customer pays **$127.50**: (5 × $7) + (5 × $6.50) + (10 × $6). Graduated pricing always increases with quantity—no "cliff" decreases occur.

| Quantity | Volume Pricing | Graduated Pricing |
|----------|---------------|-------------------|
| 5 seats  | $35 (5 × $7)  | $35 (5 × $7)      |
| 6 seats  | $39 (6 × $6.50) | $41.50 (5×$7 + 1×$6.50) |
| 15 seats | $90 (15 × $6) | $97.50 (5×$7 + 5×$6.50 + 5×$6) |

Tier configuration uses `up_to`, `unit_amount`, and optional `flat_amount` parameters. The last tier must have `up_to: 'inf'`. Tiers can include flat fees added regardless of quantity—useful for platform fees or minimum charges.

## Mid-cycle proration uses second-level precision

Stripe calculates prorations using the formula: **Prorated Amount = (Total Price ÷ Total Seconds) × Seconds Remaining**. When a customer changes from 5 seats ($50/month at $10/seat) to 10 seats mid-cycle on day 15 of a 30-day month, Stripe creates two line items:

1. **Credit**: -$25 (unused value of 5 seats for remaining 15 days: $50 × 0.5)
2. **Debit**: +$50 (value of 10 seats for remaining 15 days: $100 × 0.5)
3. **Net proration**: $25 added to next invoice

The `proration_behavior` parameter controls this with three options:
- `create_prorations` (default): Creates proration items collected at next billing cycle
- `always_invoice`: Creates prorations AND immediately generates/charges an invoice
- `none`: No prorations—new pricing takes effect at next cycle only

### Volume pricing proration creates counterintuitive results

With volume discount tiers, proration math becomes non-obvious. Consider a customer at **90 seats** (Tier 1: $5/unit = $450/month) who adds 20 more seats mid-month:

**New total**: 110 seats × $4/unit (Tier 2 rate) = $440/month

**Proration at 50% remaining in cycle**:
- Credit: $450 × 0.5 = $225
- Debit: $440 × 0.5 = $220
- **Net credit: $5** (customer receives credit despite adding seats)

This occurs because all 110 seats now qualify for the lower Tier 2 rate. The implementation must communicate this clearly to customers—adding seats resulted in a credit, not a charge.

## API implementation requires specific endpoint patterns

### Updating subscription quantity

The primary endpoint `POST /v1/subscriptions/{subscription_id}` accepts quantity changes:

```javascript
await stripe.subscriptions.update('sub_xxx', {
  items: [{
    id: 'si_xxx',           // Required: subscription item ID
    quantity: 10             // New seat count
  }],
  proration_behavior: 'always_invoice',
  proration_date: Math.floor(Date.now() / 1000)  // Optional: match preview
});
```

**Critical**: Always specify the subscription item `id`. Omitting it creates a *new* subscription item rather than updating the existing one.

### Previewing charges before confirmation

The `POST /v1/invoices/create_preview` endpoint shows customers their prorated charges before confirming:

```javascript
const preview = await stripe.invoices.createPreview({
  subscription: 'sub_xxx',
  subscription_details: {
    items: [{ id: 'si_xxx', quantity: 10 }],
    proration_behavior: 'create_prorations'
  }
});
// Display preview.amount_due, preview.lines.data
```

Preview invoices persist for 72 hours with `upcoming_` ID prefixes. Pass `subscription_proration_date` from the preview to the actual update to ensure exact matching—prorations calculated to the second means even brief delays change amounts.

## Webhook events sequence for seat management

Seat changes trigger a predictable event sequence:

| Event | When It Fires | Recommended Action |
|-------|--------------|-------------------|
| `customer.subscription.updated` | Immediately on quantity change | Update internal seat count, log change |
| `invoiceitem.created` | When proration items generated | Record proration details |
| `invoice.created` | New invoice generated | Optional: add custom line items |
| `invoice.finalized` | Invoice ready for payment | Record finalized amount |
| `invoice.payment_succeeded` | Payment completed | **Provision seats now** |
| `invoice.payment_failed` | Payment attempt failed | Notify customer, pause seat addition |

The `customer.subscription.updated` payload includes `previous_attributes` showing what changed:

```json
{
  "data": {
    "object": { "items": { "data": [{ "quantity": 10 }] } },
    "previous_attributes": { "items": { "data": [{ "quantity": 5 }] } }
  }
}
```

**Critical**: Stripe doesn't guarantee event delivery order. Always verify current state via API rather than assuming event sequence. Process webhooks idempotently by logging event IDs.

## Implementation patterns for different pricing models

### Metered billing versus licensed billing

**Licensed billing** (quantity-based) works best for predictable seat counts with changes occurring monthly or less frequently. Stripe warns that "updating the quantity on a subscription many times in an hour may result in rate limiting."

**Metered billing** suits high-frequency changes—report usage throughout the billing period, bill in arrears. No prorations occur since charges are usage-based.

### Hybrid base fee plus per-seat model

Combine subscription items for platform fees plus variable seats:

```javascript
await stripe.subscriptions.create({
  customer: 'cus_xxx',
  items: [
    { price: 'price_base_fee', quantity: 1 },      // $50 platform fee
    { price: 'price_per_seat', quantity: seatCount } // $10/seat
  ]
});
```

### Transform quantity for package pricing

For "every 5 seats" pricing, use `transform_quantity`:

```javascript
await stripe.prices.create({
  unit_amount: 5000,  // $50 per 5-seat package
  transform_quantity: { divide_by: 5, round: 'up' },
  recurring: { interval: 'month', usage_type: 'licensed' }
});
```

## Critical pitfalls to avoid in implementation

**Race conditions on quantity updates** occur when multiple requests execute simultaneously. The pattern `fetch quantity → add 1 → update` creates data races. Implement application-layer locking or use idempotency keys.

**Quantity reset on price changes**: Stripe documentation explicitly states that "updating a subscription price automatically reverts the quantity to the default value of 1." Always include current quantity when changing prices.

**Negative prorations aren't auto-refunded**: When customers reduce seats, credits accumulate on their account balance and apply to future invoices—they're not automatically refunded. Communicate this clearly and offer manual refund options for significant credits.

**Failed payments leave subscription updated**: With `proration_behavior: 'always_invoice'`, the subscription quantity updates even if payment fails. Use `payment_behavior: 'error_if_incomplete'` to return a 402 error on payment failure, then implement rollback logic:

```javascript
try {
  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, quantity: newQuantity }],
    proration_behavior: 'always_invoice',
    payment_behavior: 'error_if_incomplete'
  });
} catch (error) {
  if (error.type === 'StripeCardError') {
    // Revert quantity without creating reverse prorations
    await stripe.subscriptions.update(subId, {
      items: [{ id: itemId, quantity: originalQuantity }],
      proration_behavior: 'none'
    });
  }
}
```

**Trial period interactions**: Quantity changes during free trials don't generate prorations since no billing occurs. Track seat changes during trials separately and apply final quantity when the trial ends.

## User experience requires charge transparency

Every seat management interface should **preview charges before confirmation**. Display:
- Per-seat cost at current tier
- Prorated charge for current period (with clear explanation)
- New recurring total after this billing cycle
- Whether credits or charges result from the change

For downgrades, explain credit behavior explicitly—customers expect immediate refunds but receive account credits by default. Consider offering immediate refund options for credits exceeding a threshold.

Restrict self-service seat changes when invoices are past_due, during dunning/retry cycles, or when subscriptions are in incomplete states. These scenarios complicate proration logic and payment handling.

## Conclusion

Stripe's seat-based billing with volume discounts requires deliberate architectural choices: volume versus graduated pricing determines tier transition behavior, `proration_behavior` controls whether charges are immediate or deferred, and webhook handling must account for out-of-order delivery and payment failures. The most common implementation failures involve race conditions, quantity resets on price changes, and inadequate handling of negative prorations. Always preview charges before seat changes, implement rollback logic for payment failures, and use `payment_behavior: 'error_if_incomplete'` for immediate billing scenarios. For high-frequency seat changes, consider metered billing to avoid rate limiting.