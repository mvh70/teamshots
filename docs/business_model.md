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

#### Try Once (One-time Purchase)
```
Price: $5
Photos: 1 photo
Purpose: Low-friction proof of concept
```

#### Individual Package
```
Price: $19.99
Photos: 5 photos
Purpose: Personal professional headshots
```

### Team Plans (teamshotspro.com)

#### Team Small
```
Price: $19.99
Photos: 5 photos
Team Size: Up to 5 team members
Purpose: Small teams and startups
```

#### Team Large
```
Price: $59.99
Photos: 20 photos
Team Size: Unlimited team members
Purpose: Larger organizations and enterprises
```

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

**Why Photo-Based Pricing:**
- Transparent and simple (5 photos = $19.99)
- No complex credit systems or rollover confusion
- Direct correlation between price and value

**Package Strategy:**
- Small packages encourage trying the service
- Larger packages provide volume discounts
- Team Large offers unlimited members for scale

## Revenue Streams

### Primary
1. **Photo Packages** - One-time purchases for photo generation
2. **Try Once** - Acquisition funnel entry point
3. **Team Plans** - B2B photo packages

### Future (Post-MVP)
- Enterprise pricing
- API access for developers

## Unit Economics

**Using direct Gemini API (not Replicate) = 30-50% cost savings**

### Per Photo Costs & Margins

| Item | Cost | Revenue | Margin |
|------|------|---------|--------|
| Gemini API (4 variations) | $0.10 | - | - |
| Infrastructure (monthly/user) | ~$0.50 | - | - |
| **Try Once** | $0.10 | $5.00 | 98% |
| **Individual (5 photos)** | $0.50 | $19.99 | 97% |
| **Team Small (5 photos)** | $0.50 | $19.99 | 97% |
| **Team Large (20 photos)** | $2.00 | $59.99 | 97% |

**All scenarios maintain 95%+ gross margins.**

## Conversion Funnel Strategy

```
Try Once ($5)
    ↓
User sees quality, wants more photos
    ↓
"Buy Individual Package - 5 photos for $19.99"
    ↓
Small teams need team features
    ↓
"Buy Team Small - 5 photos for $19.99 + team features"
    ↓
Growing teams need more photos
    ↓
"Upgrade to Team Large - 20 photos for $59.99"
```

## Pricing Configuration

All pricing stored in `config/pricing.ts`:

```typescript
export const PRICING_CONFIG = {
  // Photo-based system (changed from credits)
  photos: {
    perGeneration: 1, // Each generation uses 1 photo
  },

  // Try Once (one-time purchase)
  tryOnce: {
    price: 5.00,
    photos: 1,
    stripePriceId: STRIPE_PRICE_IDS.TRY_ONCE || '',
  },

  // Individual tier (Personal - one-time purchase)
  individual: {
    price: 19.99,
    photos: 5,
    stripePriceId: STRIPE_PRICE_IDS.INDIVIDUAL || '',
  },

  // Team Small tier (Business - up to 5 team members)
  teamSmall: {
    price: 19.99,
    photos: 5,
    maxTeamMembers: 5,
    stripePriceId: STRIPE_PRICE_IDS.PRO_SMALL || '',
  },

  // Team Large tier (Business - unlimited team members)
  teamLarge: {
    price: 59.99,
    photos: 20,
    maxTeamMembers: null, // unlimited
    stripePriceId: STRIPE_PRICE_IDS.PRO_LARGE || '',
  },

  costs: {
    geminiApiPerGeneration: 0.10,
  },
}
```

## Competitive Positioning

**vs. Traditional Photography:**
- 100x faster (60 seconds vs. weeks)
- 20x cheaper ($4/photo vs. $50-200/person)
- 100% remote

**vs. Competitor AI Tools:**
- Lower entry ($5 vs. $29)
- Package model = clear value proposition
- Domain separation for individual vs team use cases

**vs. DIY Photoshop:**
- No skills required
- Instant results
- Consistent quality

## Open Questions

- [ ] Validate Gemini API actual costs per generation
- [ ] Test conversion rate from Try Once → Individual Package
- [ ] Monitor average package utilization
- [ ] Test domain-based signup effectiveness