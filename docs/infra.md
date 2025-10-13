# Infrastructure

## Domain Structure

**Marketing site:** www.teamshots.vip
- Landing page
- Pricing page
- Public-facing content

**Application:** app.teamshots.vip
- Dashboard (post-login)
- Photo generation
- Account management
- All authenticated features

## Tech Stack

### Frontend
- **Next.js 15+**: React framework, SSR
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **next-intl**: Internationalization (EN/ES)

### Backend
- **Next.js API Routes**: REST endpoints
- **Hosting**: Hetzner VPS with Coolify Cloud
- **Runtime**: Node.js containers (Docker)
- **Container Orchestration**: Managed by Coolify

### Authentication
- **Auth.js (NextAuth.js)**: Authentication system
- **OAuth Providers**: Google, GitHub
- **Session Management**: JWT-based sessions

### Database
- **PostgreSQL**: User data, credits, transactions
- **Hosting**: Hetzner VPS (Docker container via Coolify) or Hetzner Cloud Database

### AI Processing
- **Google Gemini API**: Image generation (Gemini 2.5 Flash - "Nano Banana")
- **Direct API Access**: No intermediary (Replicate, etc.) for cost efficiency
- **Endpoint**: https://ai.google.dev/gemini-api/docs/image-generation
- **Provider Abstraction**: Interface-based design for easy model switching if needed

### Storage
- **Hetzner S3**: Photo storage (uploaded & generated)
- **Retention**: 30 days default

### Payments
- **Stripe**: Subscriptions + credit purchases
- **Webhook handling**: Real-time payment events

### Email
- **Transactional**: TBD (Resend, SendGrid, or Postmark)
- **Templates**: Order confirmation, credit purchase, payment failure

### Monitoring
- **Error tracking**: TBD (Sentry or similar)
- **Analytics**: TBD (PostHog, Mixpanel, or simple)

## Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚         User Browser (Next.js)          â”‚
â”‚  Upload â†’ Customize â†’ Review â†’ Download â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚    API Routes (Hetzner + Coolify)       â”‚
â”‚  /api/upload, /api/generate, /api/download â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                   â”‚
    â”Œâ”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”
    â”‚ Database â”‚      â”‚ Gemini API  â”‚
    â”‚(Hetzner) â”‚      â”‚ (Generation)â”‚
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
    â”Œâ”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
    â”‚ Hetzner  â”‚
    â”‚ S3       â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## AI Integration Architecture

### Direct Gemini API Integration

**Decision:** Direct API access (not via Replicate or other intermediaries)

**Rationale:**
- **30-50% cost savings** - No middleman markup
- **Simpler architecture** - Fewer dependencies
- **Better control** - Direct access to rate limits, billing, error handling
- **Latest features** - Immediate access to new Gemini capabilities

### Provider Abstraction Pattern

While using Gemini directly, maintain flexibility with an abstraction layer:

```typescript
// lib/image-generator/types.ts
export interface GenerationParams {
  imageUrl: string
  stylePreset: string
  backgroundOption: string
  prompt: string
}

export interface GenerationResult {
  variations: string[]
  cost: number
  metadata: Record<string, any>
}

export interface ImageGenerator {
  generate(params: GenerationParams): Promise<GenerationResult>
}
```

```typescript
// lib/image-generator/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

export class GeminiGenerator implements ImageGenerator {
  private client: GoogleGenerativeAI
  
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }
  
  async generate(params: GenerationParams): Promise<GenerationResult> {
    // Implementation with direct Gemini API calls
    const model = this.client.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    // Generate 4 variations
    const variations = await Promise.all([
      this.generateSingle(model, params),
      this.generateSingle(model, params),
      this.generateSingle(model, params),
      this.generateSingle(model, params),
    ])
    
    return {
      variations,
      cost: 0.10, // Actual cost per generation
      metadata: { model: 'gemini-2.5-flash' }
    }
  }
  
  private async generateSingle(model: any, params: GenerationParams) {
    // Actual Gemini API call
  }
}
```

```typescript
// lib/image-generator/index.ts
export const imageGenerator = new GeminiGenerator()

// If you ever need to switch providers:
// export const imageGenerator = new ReplicateGenerator()
// Takes 5 minutes to swap
```

### Error Handling & Retries

Simple retry logic for transient failures:

```typescript
async function generateWithRetry(params: GenerationParams, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await imageGenerator.generate(params)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * Math.pow(2, i)) // Exponential backoff
    }
  }
}
```

### Cost Tracking

Track actual costs per generation for profitability analysis:

```typescript
// After each generation
await prisma.generation.create({
  data: {
    userId,
    creditsUsed: 4,
    actualCost: result.cost, // e.g., 0.10 USD
    provider: 'gemini',
    // ... other fields
  }
})
```

## API Endpoints

### Core
- `POST /api/upload` - Upload photo
- `POST /api/generate` - Generate variations
- `GET /api/download/:id` - Download photo
- `GET /api/health` - Health check for monitoring

### Account
- `GET /api/user/profile` - User info
- `GET /api/user/credits` - Credit balance
- `GET /api/user/history` - Generation history

### Billing
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/webhook` - Handle payment events
- `POST /api/credits/purchase` - Buy credits

### Marketing
- `POST /api/waitlist` - Waitlist signup
- `GET /api/waitlist` - View waitlist (admin)

## Data Models

### User
```typescript
{
  id: string
  email: string
  name?: string
  image?: string // OAuth profile picture
  locale: 'en' | 'es' // Language preference
  credits: number
  subscription_tier: 'starter' | 'pro' | null
  subscription_period: 'monthly' | 'annual' | null
  subscription_status: 'active' | 'cancelled' | null
  created_at: timestamp
}
```

### Generation
```typescript
{
  id: string
  user_id: string
  uploaded_photo_url: string
  style_preset: string
  background_option: string
  variations: string[] // URLs
  credits_used: number
  actual_cost: number // USD cost from provider (e.g., 0.10)
  provider: string // 'gemini'
  status: 'processing' | 'completed' | 'failed'
  created_at: timestamp
}
```

### Transaction
```typescript
{
  id: string
  user_id: string
  type: 'try_once' | 'subscription' | 'top_up' | 'generation'
  amount: number // USD
  credits_delta: number // positive for purchases, negative for usage
  stripe_payment_id?: string
  created_at: timestamp
}
```

## Configuration Management

### Brand Configuration
All brand values in `src/config/brand.ts`:
- Brand name, tagline, domain
- Contact emails
- Color palette
- Logo paths
- SEO defaults

### Pricing Configuration
All pricing in `src/config/pricing.ts`:
- Try Once pricing
- Subscription tiers (monthly/annual)
- Included credits per tier
- Top-up prices per tier
- Stripe Price IDs

See Business Model doc for actual pricing values.

Brand colors defined as CSS variables in `src/app/[locale]/globals.css` and made available to Tailwind. Components use theme colors (e.g., `bg-brand-primary`) instead of hard-coded values.

## Code Organization Principles

**Goal:** Maintain clean, reusable codebase for future projects (boilerplate-ready)

### Configuration-Driven
- All business logic in `config/` files (pricing, features, styles)
- No hard-coded values in components
- Environment variables for all external services
- Easy to swap values without touching code

### Separation of Concerns
```
/lib          - Business logic, utilities, external integrations
/components   - Reusable UI components (no business logic)
/app          - Routes and page compositions
/config       - All configuration (pricing, features, etc.)
```

### Type Safety
- Full TypeScript coverage
- Shared types in `/types` or `/lib/types`
- Prisma for type-safe database access
- Zod for runtime validation

### Reusable Utilities
- Generic functions in `/lib` (not project-specific)
- Abstract external services (easy to swap providers)
- Example: Image generator interface allows switching from Gemini to other providers

### No Business Logic in Components
- Components receive props, render UI
- Business logic in custom hooks or `/lib` functions
- API calls in route handlers or dedicated services

### Clear Naming
- Descriptive file and function names
- Consistent naming patterns
- Self-documenting code over comments

## Environment Variables

```bash
# Database
DATABASE_URL=

# Auth.js
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET= # Generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# AI
GEMINI_API_KEY=

# Storage
HETZNER_S3_ENDPOINT=
HETZNER_S3_ACCESS_KEY=
HETZNER_S3_SECRET_KEY=
HETZNER_S3_BUCKET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=

# Coolify (managed by Coolify Cloud)
# These are auto-configured by Coolify:
# - COOLIFY_APP_ID
# - COOLIFY_BRANCH
# - COOLIFY_DEPLOYMENT_UUID
```

## Deployment

### Hosting
- **Hetzner VPS**: Application hosting (CPX31 or CCX23 recommended)
- **Coolify Cloud**: Deployment management & orchestration
- **Database**: PostgreSQL on same Hetzner VPS or separate instance
- **Storage**: Hetzner Object Storage (S3-compatible)

### Coolify Setup
- Connect GitHub repository
- Set environment variables in Coolify dashboard
- Configure custom domain with SSL (auto-provisioned by Coolify)
- Automatic Docker container builds from Next.js
- Zero-downtime deployments

### Infrastructure Requirements
**Hetzner VPS Recommendation:**
- **Production**: CPX31 (4 vCPU, 8GB RAM) - ~â‚¬15/month
- **Staging**: CPX11 (2 vCPU, 2GB RAM) - ~â‚¬5/month
- **Object Storage**: Pay-as-you-go (~â‚¬0.01/GB/month)
- **Bandwidth**: Included (20TB for CPX31)

Total estimated cost: ~â‚¬25-30/month for production + staging

### Docker Configuration
- `Dockerfile` in project root for Next.js app
- Coolify auto-detects and builds from Dockerfile
- Multi-stage build for optimized image size
- Health check endpoint: `/api/health`

### CI/CD
- Push to `main` â†’ Coolify auto-deploy to production
- Push to `develop` â†’ Coolify auto-deploy to staging
- Docker containers managed by Coolify
- Automatic health checks and rollbacks

### Environments
- **Development**: Local (Docker Compose recommended)
- **Staging**: staging.domain.com (Hetzner)
- **Production**: domain.com (Hetzner)