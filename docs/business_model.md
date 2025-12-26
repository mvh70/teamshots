# Business Model

## Pricing Model
**Domain-based plan system with photo packages**

**Updated from credit-based system to photo-based pricing for simplicity and transparency.**

Plans are determined by domain:
- **photoshotspro.com**: Individual plans for personal use
- **teamshotspro.com**: Team plans for business use

All features are included with each plan - no additional charges.

## Pricing Structure

### Individual Plans (photoshotspro.com)

#### Try It For Free
```
Price: Free
Credits: 10 credits (1 photo)
Purpose: Low-friction trial to test the service
```

#### Individual Package
```
Price: $19.99
Credits: 40 credits (4 photos with regenerations)
Photos: 5 unique styles, 1 regeneration each
Purpose: Personal professional headshots
```

#### VIP Package
```
Price: $199.99
Credits: 250 credits (25 photos with regenerations)
Photos: 25 unique styles, 3 regenerations each
Purpose: High-volume individual users and professionals
```

### Team Plans (teamshotspro.com)

#### Try It For Free
```
Price: Free
Credits: 30 credits (3 photos)
Purpose: Test the service before purchasing seats
```

#### Seats-Based Pricing (Volume Discounts)
```
Price per seat (2-9 seats): $29.00
Price per seat (10-24 seats): $19.90
Price per seat (25+ seats): $15.96

Credits per seat: 100 (10 photos with 2 regenerations each)
Minimum purchase: 2 seats
Purpose: Scalable team pricing with volume discounts
```

**Example Pricing:**
- 5 seats: 5 × $29.00 = $145.00 (50 total photos)
- 15 seats: 15 × $19.90 = $298.50 (150 total photos)
- 30 seats: 30 × $15.96 = $478.80 (300 total photos)

## Domain-Based Access Control

**photoshotspro.com:**
- Individual signup only
- Personal photo generation
- Single user accounts

**teamshotspro.com:**
- Team signup only
- Team photo generation
- Team management features
- Member invitation system

## Pricing Psychology

**Why Domain Separation:**
- Clear value proposition for each audience
- Individual vs team use cases are fundamentally different
- Prevents feature confusion and misuse

**Why Credit-Based System:**
- Flexible: 10 credits = 1 photo generation with variations
- Regenerations cost additional credits (quality control)
- Transparent tracking of usage and remaining balance

**Package Strategy:**
- Free trials for both individual and team users
- Individual: VIP ($199.99) creates price anchoring effect for Individual ($19.99)
- Team: Volume discounts incentivize larger seat purchases
- Minimum 2 seats ensures team pricing is for actual teams

**Volume Discount Benefits:**
- Scales with team size naturally
- Rewards larger commitments with lower per-seat costs
- Simple, transparent pricing tiers

## Revenue Streams

### Primary
1. **Individual Packages** - One-time purchases for personal use
   - Individual ($19.99) - Entry-level professional headshots
   - VIP ($199.99) - High-volume users and professionals
2. **Seats-Based Pricing** - Scalable team purchases with volume discounts
3. **Free Trials** - Acquisition funnel (Try It For Free)
4. **Top-Ups** - Additional credit purchases for existing customers

### Future (Post-MVP)
- Enterprise custom pricing
- API access for developers
- White-label solutions

## Unit Economics

**Using direct Gemini API (not Replicate) = 30-50% cost savings**

### Per Photo Costs & Margins

| Item | Cost | Revenue | Margin |
|------|------|---------|--------|
| Gemini API (1 generation) | $0.10 | - | - |
| Infrastructure (monthly/user) | ~$0.50 | - | - |
| **Individual (4 photos)** | $0.40 | $19.99 | 98% |
| **VIP (25 photos)** | $2.50 | $199.99 | 99% |
| **Seats - 5 seats (50 photos)** | $5.00 | $145.00 | 97% |
| **Seats - 15 seats (150 photos)** | $15.00 | $298.50 | 95% |
| **Seats - 30 seats (300 photos)** | $30.00 | $478.80 | 94% |

**All scenarios maintain 94%+ gross margins, with individual packages achieving 98%+ margins.**

### Top-Up Economics
- Individual tier: $19.99 for 40 credits (4 photos)
- VIP tier: $69.99 for 100 credits (10 photos)
- Cost: $0.10 per photo generation
- Margin: 95%+ on all top-ups

## Conversion Funnel Strategy

### Individual Domain (photoshotspro.com)
```
Try It For Free (1 photo)
    ↓
User sees quality, wants more photos
    ↓
Individual Package ($19.99 for 4 photos)
    ↓
High-volume users or professionals
    ↓
VIP Package ($199.99 for 25 photos)
    ↓
Needs team features → Redirect to teamshotspro.com
```

### Team Domain (teamshotspro.com)
```
Try It For Free (3 photos)
    ↓
Team admin validates quality
    ↓
Purchase 2-9 seats ($29/seat)
    ↓
Team grows or needs volume discount
    ↓
Purchase 10-24 seats ($19.90/seat)
    ↓
Large team deployment
    ↓
Purchase 25+ seats ($15.96/seat)
    ↓
Need more photos → Top-up credits
```

## Pricing Configuration

All pricing stored in `config/pricing.ts`:

```typescript
export const PRICING_CONFIG = {
  // Credits system
  credits: {
    perGeneration: 10, // Each generation uses 10 credits
    rollover: true,
    rolloverLimit: null, // unlimited rollover
  },

  // Regeneration system
  regenerations: {
    tryItForFree: 1,
    individual: 1,
    vip: 3, // VIP gets most retries
    seats: 2, // Seats-based pricing gets 2 regenerations
  },

  // Individual tier (Personal - one-time purchase)
  individual: {
    price: 19.99,
    credits: 40, // 4 photos at 10 credits each
    stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL || '',
    topUp: {
      price: 19.99,
      credits: 40,
      stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL_TOP_UP || '',
    },
  },

  // VIP tier (Individual domain anchor - one-time purchase)
  vip: {
    price: 199.99,
    credits: 250, // 25 photos at 10 credits each
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.VIP || '',
    topUp: {
      price: 69.99,
      credits: 100, // 10 photos at 10 credits each
      stripePriceId: STRIPE_PRICE_IDS.VIP_TOP_UP || '',
    },
  },

  // Seats-based pricing (TeamShotsPro domain)
  seats: {
    minSeats: 2, // Minimum 2 seats required
    creditsPerSeat: 100, // 10 photos per seat
    photosPerSeat: 10,
    stripePriceId: STRIPE_PRICE_IDS.TEAM_SEATS || '',
    volumeTiers: [
      { min: 25, max: Infinity, pricePerSeat: 15.96 },
      { min: 10, max: 24, pricePerSeat: 19.90 },
      { min: 2, max: 9, pricePerSeat: 29.00 }
    ],
  },

  // Free trial credits (granted on signup)
  freeTrial: {
    individual: 10,  // Credits for individual users on free plan
    pro: 30,         // Credits for pro users (teams) on free plan
  },

  costs: {
    geminiApiPerGeneration: 0.10,
  },
}
```

## Competitive Positioning

**vs. Traditional Photography:**
- 100x faster (60 seconds vs. weeks)
- 10-50x cheaper ($2-5/photo vs. $50-200/person)
- 100% remote

**vs. Competitor AI Tools:**
- Lower entry (Free trial vs. $29+)
- Scalable team pricing with volume discounts
- Domain separation for individual vs team use cases
- One-time payment model (no subscriptions)

**vs. DIY Photoshop:**
- No skills required
- Instant results
- Consistent quality across entire team

## Open Questions

- [ ] Validate Gemini API actual costs per generation
- [ ] Test conversion rate from Free Trial → Paid packages
- [ ] Monitor seat purchase patterns and volume tier distribution
- [ ] Test domain-based signup effectiveness
- [ ] Measure top-up frequency and amounts
- [ ] Track average seats per purchase and expansion patterns