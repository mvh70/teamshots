# Infrastructure

## Domain Structure

**Marketing site:** www.teamshots.vip
- Landing page
- Pricing page
- Public-facing content

**Individual Application:** photoshotspro.com
- Individual photo generation
- Personal account management
- Single user features

**Team Application:** teamshotspro.com
- Team photo generation
- Team management features
- Multi-user collaboration
- Admin controls

## Multi-Domain Landing Page Architecture

Each domain serves a domain-specific landing page with unique design, content, and available packages:

| Domain | Landing Component | Focus |
|--------|------------------|-------|
| teamshotspro.com | `TeamShotsLanding.tsx` | B2B, team management, 5-step workflow |
| photoshotspro.com | `PhotoShotsLanding.tsx` | Individual, personal branding, 3-step workflow |

### Key Files
- `src/app/[locale]/page.tsx` - Server-side domain detection, loads correct landing
- `src/app/[locale]/landings/*.tsx` - Domain-specific landing pages
- `src/config/brand.ts` - Typography and style tokens per domain
- `src/config/landing-content.ts` - Package availability per domain

### Brand Configuration
Each domain has its own:
- **Typography**: `displayFont`, `bodyFont`
- **Style tokens**: `borderRadius` (sharp/rounded/pill), `shadowIntensity` (subtle/medium/dramatic), `tone` (corporate/friendly/playful)
- **Packages**: Available photo style packages and default selection

### Adding a New Domain
1. Add domain constant to `src/config/domain.ts`
2. Add brand config to `src/config/brand.ts` (colors, typography, style tokens)
3. Add package config to `src/config/landing-content.ts`
4. Create landing component in `src/app/[locale]/landings/`
5. Register in `LANDING_COMPONENTS` map in `page.tsx`
6. Add translations under `landing.<domainname>` in `messages/en.json` and `messages/es.json`

### Domain Detection Policy

**All domain decisions are server-side only.** No client-side detection allowed.

This prevents:
- Hydration mismatches (flicker between brands)
- Client manipulation/abuse
- Inconsistent user experience

**Architecture:**
1. **Marketing pages**: `layout.tsx` detects domain via `headers()`, passes `variant` prop to Header/Footer/Landing
2. **App routes**: `app/layout.tsx` detects domain, provides `isIndividualDomain` via `DomainContext`
3. **Components**: Receive brand info via props, never detect domain themselves

**Key files:**
- `src/contexts/DomainContext.tsx` - React context for app routes
- `src/config/brand.ts` - `getBrand(headers)` (server-side only)
- `src/config/landing-content.ts` - `getLandingVariant(domain)` (server-side only)

**Local Development:**
```env
NEXT_PUBLIC_FORCE_DOMAIN=photoshotspro.com
```
Restart dev server after changing: `rm -rf .next && npm run dev`

## Internationalization Architecture

### Locale Support
- **Languages**: English (en), Spanish (es)
- **Default**: English
- **Detection**: URL → Session → Browser preference

### URL Routing
- **Marketing**: `www.teamshots.vip` (EN) / `www.teamshots.vip/es` (ES)
- **App**: `app.teamshots.vip` (EN) / `app.teamshots.vip/es` (ES)
- **Internal**: `/app-routes/` with locale prefixes

### Technical Implementation
- **Library**: next-intl
- **Middleware**: Automatic locale detection and routing
- **Navigation**: Locale-aware Link and useRouter hooks
- **Translations**: JSON files in `/messages/` directory

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

### Background Processing
- **Technology**: Python 3.9+ with rembg library
- **Purpose**: Remove backgrounds from uploaded selfies for better AI generation
- **Integration**: Node.js worker calls Python script via child_process
- **Architecture**: User uploads selfie → S3 storage → Python rembg processing → Processed selfie cached in S3 → AI generation uses processed version
- **Dependencies**: Python 3.9+, rembg>=2.0.50, Pillow>=9.0.0, numpy>=1.21.0, onnxruntime
- **Model**: u2net_human_seg (optimized for human subjects with good quality/size balance)

### Storage
- **S3 Storage**: Photo storage (uploaded & generated) - Supports Backblaze B2, Hetzner, AWS S3, etc.
- **Retention**: 30 days default

#### Hetzner S3 CORS (Browser uploads)

Single source of truth to enable browser uploads to Hetzner S3.

Problem: AWS CLI sometimes fails to set CORS on Hetzner's S3 API.
Solution: Use boto3 (Python) instead.

Steps (run once per bucket):

1) Install boto3
```
pip3 install boto3
```

2) Create `set_cors.py`
```python
import boto3
from botocore.client import Config

s3 = boto3.client(
    's3',
    endpoint_url='https://nbg1.your-objectstorage.com',  # Hetzner compat endpoint (include https)
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY',
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

cors_configuration = {
    'CORSRules': [{
        'AllowedOrigins': [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://app.teamshots.vip',
            'https://www.teamshots.vip'
        ],
        'AllowedMethods': ['GET', 'PUT', 'HEAD'],
        'AllowedHeaders': ['*'],
        'MaxAgeSeconds': 300
    }]}

s3.put_bucket_cors(Bucket='teamshots', CORSConfiguration=cors_configuration)
print('CORS configuration set successfully!')
```

3) Run
```
python3 set_cors.py
```

Notes
- Use the Hetzner "compat" endpoint (not website URL) and include `https://`.
- Hetzner S3 may not accept `ExposeHeaders` or `OPTIONS` in CORS; the config above is the minimal working set for signed PUT uploads.
- After applying, wait ~1–2 minutes before testing uploads.

### Payments
- **Stripe**: Subscriptions + credit purchases
- **Webhook handling**: Real-time payment events

### Email
- **Transactional**: TBD (Resend, SendGrid, or Postmark)
- **Templates**: Order confirmation, credit purchase, payment failure

### Monitoring
- **Error tracking**: TBD (Sentry or similar)
- **Analytics**: TBD (PostHog, Mixpanel, or simple)

## Code Organization Boundaries

- src/lib: generic, framework-agnostic utilities only (http, fetcher, logger, telemetry, result, errors, format, env/flags, server-headers). No business terms and no imports of `src/config/pricing`.
- src/domain: business logic (pricing, credits, subscriptions, access/roles/permissions, auth/otp, image access, generation). `PRICING_CONFIG` is only imported here.
- Logging/Metrics: use `Logger` and `Telemetry` wrappers. Telemetry can forward to PostHog; prefer server-side events for domain actions.

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useMobileViewport()` | Viewport detection (<768px) |
| `useGenerationFlowState()` | Flow state via sessionStorage |
| `useSelfieManagement(opts)` | Selfie operations (individual/invite) |
| `useSelfieSelection(endpoint)` | Selected selfies state + API sync |
| `useUploadFlow(opts)` | Upload state machine with temp storage |
| `useInviteSelfieEndpoints(token)` | Upload/save endpoints for invites |

## Key Components

| Component | Purpose |
|-----------|---------|
| `IntroScreenContent` | Generic intro screen (swipe/button variants) |
| `SelfieTipsContent` | Selfie best practices intro |
| `CustomizationIntroContent` | Customization intro |
| `CameraPermissionError` | Camera access denied UI |

## Constants

- `MIN_SELFIES_REQUIRED = 2` (`src/constants/generation.ts`)

## Architecture

```
┌─────────────────────────────────────────────┐
│         User Browser (Next.js)          │
│  Upload → Customize → Review → Download │
└─────────────────────────────────┬───────────┘
                │
┌─────────────────────────────────▼─────────────┐
│    API Routes (Hetzner + Coolify)       │
│  /api/upload, /api/generate, /api/download │
└─────────────────────────────┬─────────────┬───┘
        │                   │
   ┌────▼───┐      ┌────────▼────────┐
   │ Database │      │ Gemini API  │
   │(Hetzner) │      │ (Generation)│
   └────────┬─┘      └───────────────┘
        │
   ┌────▼───┐
   │ Hetzner  │
   │ S3       │
   └──────────┘
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
import { VertexAI } from '@google-cloud/vertexai'

export class GeminiGenerator implements ImageGenerator {
  private model: ReturnType<VertexAI['getGenerativeModel']>
  private modelName: string

  constructor() {
    const project = process.env.GOOGLE_PROJECT_ID!
    const location = process.env.GOOGLE_LOCATION ?? 'global'
    this.modelName = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash'

    const vertexAI = new VertexAI({ project, location })
    this.model = vertexAI.getGenerativeModel({ model: this.modelName })
  }

  async generate(params: GenerationParams): Promise<GenerationResult> {
    // Generate 4 variations
    const variations = await Promise.all([
      this.generateSingle(params),
      this.generateSingle(params),
      this.generateSingle(params),
      this.generateSingle(params),
    ])
    
    return {
      variations,
      cost: 0.10, // Actual cost per generation
      metadata: { model: this.modelName }
    }
  }
  
  private async generateSingle(params: GenerationParams) {
    // Actual Gemini API call via Vertex AI
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

### AI Prompting
- Packages directory: `src/domain/style/packages/`
- Each package defines a `promptBuilder(settings)` and controls the UI via `visibleCategories` and persistence adapters.

## API Endpoints

### Core (Current)
- `POST /api/uploads/proxy` - Server-side proxy upload to Hetzner S3 (validated, 10MB max)
- `GET /api/uploads/list` - List current user's selfies
- `GET /api/files/get?key=<s3-key>` - Signed GET URL for displaying an S3 image
- `GET /api/files/download?key=<s3-key>` - Signed GET URL intended for downloads
- `GET /api/generations/list` - List generations (scope=user or team, supports filters)
- `GET /api/team/members` - List team members (admin only)
- `GET /api/health` - Health check for monitoring

### Core (Planned)
- `POST /api/generate` - Create a Generation from a selfie + settings (Gemini)
- `GET /api/generations/:id` - Generation detail

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

### Styles
- `GET /api/styles/personal` - List personal styles
- `GET /api/styles/team` - List team styles (admin only)
- `POST /api/styles` - Create a style (name, scope, packageId, settings)
- `GET /api/styles/:id` - Style detail
- `PUT /api/styles/:id` - Update style (name, package settings, setAsActive)
- `DELETE /api/styles/:id` - Delete style
- `POST /api/styles/:id/activate` - Set active style



### Uploads in styles
- Persist S3 keys in settings:
  - `settings.background.key` for custom backgrounds
  - `settings.branding.logoKey` for logos
- Upload `File` objects to `/api/upload` before saving, then store returned keys in settings

## Data Models

### User
```typescript
{
  id: string
  email: string
  name?: string
  image?: string // OAuth profile picture
  locale: 'en' | 'es' // Language preference
  photos: number // Photo balance instead of credits
  planType: 'individual' | 'teamSmall' | 'teamLarge' | null
  stripeCustomerId: string?  @unique
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
  photos_used: number // Changed from credits_used
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
  type: 'try_once' | 'individual' | 'teamSmall' | 'teamLarge' | 'generation'
  amount: number // USD
  photos_delta: number // positive for purchases, negative for usage
  stripe_payment_id?: string
  created_at: timestamp
}
```

## Configuration Management

### Specific Environment Variables

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

# AI (Vertex AI)
GOOGLE_PROJECT_ID=
GOOGLE_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
GEMINI_IMAGE_MODEL=gemini-2.5-flash
GEMINI_EVAL_MODEL=

# Storage (S3-compatible: Backblaze B2, Hetzner, AWS S3, etc.)
# Use generic S3_* vars (preferred) or legacy HETZNER_S3_* vars for backward compatibility
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_REGION=
S3_FOLDER=                    # Optional: Folder prefix (e.g., "localhost", "production", "staging")
                               # All files will be stored under this prefix if set
                               # Useful for separating test/production files in the same bucket

# Legacy Hetzner S3 (backward compatibility, will be removed in future)
HETZNER_S3_ENDPOINT=
HETZNER_S3_ACCESS_KEY=
HETZNER_S3_SECRET_KEY=
HETZNER_S3_BUCKET=
HETZNER_S3_REGION=

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

*For deployment steps, see [DEPLOYMENT.md](DEPLOYMENT.md).*