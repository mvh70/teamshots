# Business Model

## Pricing Model
**Dual Credit-based system with subscriptions + top-ups**

No free tier. All features require credits.

**Credit Types:**
- **Team Credits**: Allocated by team admins for team photo generations
- **Individual Credits**: User-owned credits for personal photo generations
- **Usage Rules**: Team credits can only be used for team generations, individual credits for personal use

**Credit Management:**
- **Transaction-Based System**: All credit movements tracked in `CreditTransaction` table
- **Full Audit Trail**: Every allocation, transfer, and usage recorded with timestamps
- **Real-time Balances**: Credit balances calculated from transaction history
- **Team Invite Integration**: Credits automatically allocated when team members accept invites

## Pricing Structure

### Credits System
- **1 generation = 10 credits** (produces 4 photo variations)
- **Credits roll over** month-to-month (never expire)
- **Display format:** "60 credits (6 generations)" - emphasize credits for psychological impact

### Try Once (One-time Purchase)
```
Price: $5
Credits: 10 (1 generation)
Purpose: Low-friction proof of concept
```

### Individual Subscription
```
Monthly: $24/month â†’ 60 credits/month (6 generations)
Annual: $228/year â†’ 60 credits/month (Save $60/year, ~21% discount)

Top-ups: $9.99 per 30 credits (minimum purchase 30 credits)
```

### Pro Subscription  
```
Monthly: $59/month â†’ 200 credits/month (20 generations)
Annual: $588/year â†’ 200 credits/month (Save $120/year, ~17% discount)

Top-ups: $24.99 per 100 credits (minimum purchase 100 credits)
Pro users get a lower price per generation than Individual
```

## Pricing Psychology

**Why Credits (not just "generations"):**
- Larger numbers feel more valuable (100 > 25)
- Gamification effect increases engagement  
- Creates psychological distance from money (like casino chips)
- Users less likely to cancel with accumulated credits (sunk cost)

**Why Rollover:**
- Reduces anxiety ("use it or lose it")
- Increases perceived value
- Reduces churn (users stay even in low-usage months)
- Builds loyalty (accumulated credits = switching cost)

**Why Annual Discount:**
- 15% = industry standard, feels meaningful
- Upfront cash improves business cash flow
- Higher commitment = better retention
- Display as dollar savings: "Save $108/year" (not "15% off")

**Top-up Strategy:**
- Tier-based pricing encourages upgrades
- Minimum purchase (20 credits) prevents micro-transactions
- Pro discount (33% off) rewards commitment

## Revenue Streams

### Primary
1. **Subscriptions** - Recurring monthly/annual revenue (individual + team plans)
2. **Top-ups** - Additional revenue when users exceed base credits
3. **Try Once** - Acquisition funnel entry point
4. **Team/team plans** - B2B recurring revenue

### Future (Post-MVP)
- Enterprise pricing
- API access for developers

## Unit Economics

**Using direct Gemini API (not Replicate) = 30-50% cost savings**

### Per Generation Costs & Margins

| Item | Cost | Revenue | Margin |
|------|------|---------|--------|
| Gemini API (4 variations) | $0.10 | - | - |
| Infrastructure (monthly/user) | ~$0.50 | - | - |
| **Try Once** | $0.10 | $5.00 | 98% |
| **Starter base** | $0.10 | $0.96/gen | 90% |
| **Starter top-up** | $0.10 | $0.90/4cr | 89% |
| **Pro base** | $0.10 | $0.84/gen | 88% |
| **Pro top-up** | $0.10 | $0.60/4cr | 83% |

### Monthly User Economics (Starter)

Assumptions:
- User on Starter monthly: $24/month
- Uses all 60 credits (6 generations)
- Buys 1 top-up (30 credits, 3 generations): $9.99

```
Monthly Revenue:        $33.99
Gemini API costs:       $0.90 (9 generations Ã— $0.10)
Infrastructure costs:   $0.50
Total costs:            $1.40
Gross Margin:           96%
```

### Monthly User Economics (Pro)

Assumptions:
- User on Pro monthly: $59/month
- Uses all 200 credits (20 generations)
- Buys 1 top-up (100 credits, 10 generations): $24.99

```
Monthly Revenue:        $83.99
Gemini API costs:       $3.00 (30 generations Ã— $0.10)
Infrastructure costs:   $0.50
Total costs:            $3.50
Gross Margin:           96%
```

**All scenarios maintain 85%+ gross margins.**

## Conversion Funnel Strategy

```
Try Once ($5) 
    â†“ 
User sees quality, wants more
    â†“
"Subscribe to Starter - Save 81%"
$24/mo seems reasonable vs. $5 per generation
    â†“
Heavy users exceed 100 credits
    â†“
Top-ups at $0.90 feel expensive
    â†“
"Upgrade to Pro - Get 180 more credits + 33% off top-ups"
    â†“
Pro subscription ($59/mo)
```

## Pricing Configuration

All pricing stored in `config/pricing.ts`:

```typescript
export const PRICING_CONFIG = {
  credits: {
    perGeneration: 4,
    rollover: true,
    rolloverLimit: null, // unlimited
  },
  
  tryOnce: {
    price: 5.00,
    credits: 4,
  },
  
  starter: {
    monthly: {
      price: 24.00,
      includedCredits: 100,
    },
    annual: {
      price: 245.00,
      includedCredits: 100, // per month
    },
    topUp: {
      pricePerPackage: 0.90,
      creditsPerPackage: 4,
      minimumPurchase: 20,
    },
  },
  
  pro: {
    monthly: {
      price: 59.00,
      includedCredits: 280,
    },
    annual: {
      price: 600.00,
      includedCredits: 280, // per month
    },
    topUp: {
      pricePerPackage: 0.60,
      creditsPerPackage: 4,
      minimumPurchase: 20,
    },
  },
  
  costs: {
    geminiApiPerGeneration: 0.10,
  },
}
```

## Competitive Positioning

**vs. Traditional Photography:**
- 100x faster (60 seconds vs. weeks)
- 20x cheaper ($0.96/generation vs. $50-200/person)
- 100% remote

**vs. Competitor AI Tools:**
- Lower entry ($5 vs. $29)
- Subscription model = better for regular users
- Credits never expire (unique advantage)

**vs. DIY Photoshop:**
- No skills required
- Instant results
- Consistent quality

## Open Questions

- [ ] Validate Gemini API actual costs per generation
- [ ] Test conversion rate from Try Once â†’ Starter
- [ ] Monitor average top-up frequency
- [ ] Test annual vs. monthly uptake
- [ ] Optimal credit rollover cap (if any)