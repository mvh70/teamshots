# Getting Started Guide

## Overview
This guide walks you through building and deploying the AI Team Photo Generator using a phased approach.

**Routes (styles UI):**
- Personal: `/app/styles/personal`
- Team: `/app/styles/team`

**Packages:**
- Located at `src/domain/style/packages/` (registry in `packages/index.ts`, first package `headshot1.ts`).

## Implementation Order

### Phase 1: Foundation + Waitlist

**Waitlist Launch**
1. Hetzner + Coolify setup
2. Landing page + pricing page (www.teamshots.vip)
3. Waitlist signup form
4. Basic Resend email ("Thanks for joining!")
5. **→ LAUNCH WAITLIST PUBLICLY**

**Auth & Foundation**
6. Auth.js setup (start with email/password, OAuth if time allows)
7. Database schema + Prisma
8. App shell (app.teamshots.vip/dashboard) with "Coming soon"
   - Public, pretty paths (e.g., `/dashboard`) are mapped to internal app routes (`/app-routes/dashboard`) via Next.js rewrites. Users see only the pretty URL.
9. next-intl configuration (EN/ES)

**Payments**
10. Stripe integration
11. Credit system implementation
12. Purchase flows (Try Once, subscriptions, top-ups)
13. Credit balance display

### Phase 2: Core Feature + Launch

**Generation Feature**
14. Hetzner S3 setup
15. Photo upload UI + S3 integration
16. Style/background customization UI
16.5. Background removal system (Python rembg integration)
17. Gemini API integration
18. Generation workflow (process, display variations)

**Polish**
19. Review/download UI
20. Credit deduction logic
21. Generation history view
22. Error handling

**Final Polish**
23. Onboarding flow
24. Email notifications (generation complete, receipts)
25. Settings page

**Beta Launch**
26. Invite waitlist users
27. **→ BETA LAUNCH**

---

## Prerequisites

### Required Accounts
- [ ] GitHub account (for code hosting)
- [ ] Hetzner account (for hosting)
- [ ] Google AI Studio account (for Gemini API)
- [ ] Stripe account (for payments)
- [ ] Email service account (Resend, SendGrid, or Postmark)

### Required Tools (Install on your computer)
- [ ] Node.js 18+ ([download](https://nodejs.org))
- [ ] Git ([download](https://git-scm.com))
- [ ] Code editor (VS Code recommended)

---

## Step 1: Local Project Setup

### Create Next.js Project
```bash
# Create new Next.js project
npx create-next-app@latest team-photo-ai

# Options to select:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: No (optional)
# ✓ App Router: Yes
# ✓ Import alias: Yes (@/*)

cd team-photo-ai
```

### Install Key Dependencies
```bash
# Authentication
npm install next-auth @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs

# Internationalization
npm install next-intl

# Database & ORM
npm install @prisma/client prisma

# AI & Image Generation
npm install @google/generative-ai

# File upload & storage
npm install @aws-sdk/client-s3 sharp

# Payments
npm install stripe

# Email
npm install resend react-email

# Utilities
npm install zod
```

### Create Environment File
```bash
# Create .env.local file
touch .env.local
```

Add these variables:
```bash
# Database (local for now)
DATABASE_URL="postgresql://user:password@localhost:5432/teamphoto"

# Domains
NEXT_PUBLIC_MARKETING_URL="http://localhost:3000" # prod: https://www.teamshots.vip
NEXT_PUBLIC_APP_URL="http://localhost:3000" # prod: https://app.teamshots.vip

# Auth.js (Email/Password only for MVP)
NEXTAUTH_URL="http://localhost:3000" # prod: https://app.teamshots.vip
NEXTAUTH_SECRET="your-secret-here" # Generate: openssl rand -base64 32

# Gemini API (tested and confirmed working)
GEMINI_API_KEY="your-key-here"

# Hetzner S3
HETZNER_S3_ENDPOINT="https://fsn1.your-objectstorage.com"
HETZNER_S3_ACCESS_KEY="your-access-key"
HETZNER_S3_SECRET_KEY="your-secret-key"
HETZNER_S3_BUCKET="team-photos"

# Stripe (test mode)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Stripe Price IDs (create products in Stripe first)
STRIPE_TRY_ONCE_PRICE_ID=price_xxx
STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxx
STRIPE_STARTER_ANNUAL_PRICE_ID=price_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx

# Email (Resend recommended)
EMAIL_PROVIDER_API_KEY="your-key"
EMAIL_FROM_ADDRESS="noreply@teamshots.vip"
```

**OAuth credentials (add post-MVP):**
```bash
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

---

## Step 2: Database Setup

### Option A: Local PostgreSQL (Development)
```bash
# Install PostgreSQL locally
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql
# Windows: Download from postgresql.org

# Start PostgreSQL
# macOS: brew services start postgresql
# Ubuntu: sudo service postgresql start
```

### Option B: Use SQLite for Quick Start
Change `DATABASE_URL` to:
```bash
DATABASE_URL="file:./dev.db"
```

### Initialize Prisma
```bash
# Initialize Prisma
npx prisma init

# Create your schema in prisma/schema.prisma
# (See schema below)

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Optional: Seed database
npx prisma db seed
```

### Basic Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "sqlite"
  url      = env("DATABASE_URL")
}

// Auth.js required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?   // Only for credentials provider
  locale        String    @default("en") // 'en' or 'es'
  credits       Int       @default(0) // Legacy field - will be deprecated
  planTier           String?  // 'free' | 'try_once' | 'individual' | 'pro'
  planPeriod         String?  // 'none' | 'one_time' | 'monthly' | 'annual'
  subscriptionStatus String?  // 'active' | 'cancelled'
  stripeCustomerId   String?  @unique
  createdAt     DateTime  @default(now())
  
  accounts      Account[]
  sessions      Session[]
  generations   Generation[]
  transactions  Transaction[]
  creditTransactions CreditTransaction[]
  person        Person?
  companies     Team[] @relation("TeamAdmin")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  
  @@unique([identifier, token])
}

model Generation {
  id                String   @id @default(cuid())
  userId            String
  uploadedPhotoUrl  String
  stylePreset       String
  backgroundOption  String
  variations        String[] // Array of URLs
  creditsUsed       Int
  actualCost        Float    @default(0) // USD cost from provider
  provider          String   @default("gemini")
  status            String   // 'processing' | 'completed' | 'failed'
  createdAt         DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
}

model Transaction {
  id              String   @id @default(cuid())
  userId          String
  type            String   // 'try_once' | 'subscription' | 'top_up' | 'generation'
  amount          Float
  creditsDelta    Int
  stripePaymentId String?
  createdAt       DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
}
```

---

## Step 3: Basic Project Structure

Create this folder structure:
```
team-photo-ai/
├── app/
│   ├── [locale]/                    # next-intl locale wrapper
│   │   ├── page.tsx                 # Landing (www.teamshots.vip)
│   │   ├── pricing/page.tsx         # Pricing (www.teamshots.vip)
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts  # Auth.js routes
│   │   ├── upload/route.ts
│   │   ├── generate/route.ts
│   │   ├── download/[id]/route.ts
│   │   └── health/route.ts
│   └── layout.tsx
├── app-subdomain/                   # app.teamshots.vip routes
│   ├── [locale]/
│   │   ├── dashboard/page.tsx
│   │   ├── auth/
│   │   │   ├── signin/page.tsx
│   │   │   └── error/page.tsx
│   │   ├── generate/page.tsx
│   │   ├── history/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
├── components/
│   ├── ui/
│   ├── features/
│   └── LanguageSwitcher.tsx
├── config/
│   ├── brand.ts                     # Brand configuration
│   └── pricing.ts
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── s3.ts
│   ├── gemini.ts
│   └── stripe.ts
├── messages/
│   ├── en.json
│   └── es.json
├── public/
│   └── branding/                    # All brand assets
│       ├── logo-light.svg
│       ├── logo-dark.svg
│       ├── icon.svg
│       ├── favicon.ico
│       └── og-image.jpg
├── middleware.ts                    # Handles subdomain routing
├── i18n.ts
├── prisma/
│   └── schema.prisma
├── .env.local
├── Dockerfile
└── package.json
```

---

## Step 4: Branding Configuration

**Principle:** All brand-specific values in configuration files. Change branding by editing config, not searching through code.

### Create Brand Config

Create `config/brand.ts`:
```typescript
export const BRAND_CONFIG = {
  name: 'TeamShots',
  domain: 'teamshots.vip',
  
  contact: {
    support: 'support@teamshots.vip',
    privacy: 'privacy@teamshots.vip',
    legal: 'legal@teamshots.vip',
  },
  
  colors: {
    primary: '#6366F1',        // Indigo-500 - Brand identity
    primaryHover: '#4F46E5',   // Indigo-600
    secondary: '#10B981',      // Green-500 - Success states
    secondaryHover: '#059669', // Green-600
    cta: '#EA580C',            // Orange-600 - Call-to-action
    ctaHover: '#C2410C',       // Orange-700
  },
  
  logo: {
    light: '/branding/logo-light.svg',
    dark: '/branding/logo-dark.svg',
    icon: '/branding/icon.svg',
    favicon: '/branding/favicon.ico',
  },
  
  seo: {
    defaultTitle: 'TeamShots - Professional Team Photos with AI',
    defaultDescription: 'Transform any photo into professional team photos in 60 seconds using AI.',
    ogImage: '/branding/og-image.jpg',
  },
  
  legal: {
    companyName: 'TeamShots Inc.',
    address: '123 Main St, San Francisco, CA 94105',
  },
} as const;
```

### Configure Tailwind

Update `tailwind.config.js`:
```javascript
const { BRAND_CONFIG } = require('./config/brand');

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: BRAND_CONFIG.colors.primary,
          'primary-hover': BRAND_CONFIG.colors.primaryHover,
          secondary: BRAND_CONFIG.colors.secondary,
        }
      }
    }
  }
}
```

### Usage in Components

```typescript
// Use config values
import { BRAND_CONFIG } from '@/config/brand';

export function Header() {
  return (
    <header>
      <img src={BRAND_CONFIG.logo.light} alt={BRAND_CONFIG.name} />
      <h1>{BRAND_CONFIG.tagline}</h1>
    </header>
  );
}

// Use Tailwind theme colors
<button className="bg-brand-primary hover:bg-brand-primary-hover">
  Generate
</button>
```

### Brand Assets

Place all visual assets in `public/branding/`:
- **logo-light.svg** - Logo for light backgrounds
- **logo-dark.svg** - Logo for dark backgrounds  
- **icon.svg** - App icon/favicon source
- **favicon.ico** - Browser favicon
- **og-image.jpg** - Social media preview (1200x630px)

**For MVP:** Use text-based logos or free tools (Canva, LogoMakr) to create simple placeholders. Professional branding can wait until post-launch.

---

## Step 5: Create Pricing Configuration

Create `config/pricing.ts`:
```typescript
// In src/config/pricing.ts
const PRICE_IDS = {
  TRY_ONCE: ['price_...'],
  INDIVIDUAL_MONTHLY: ['price_...'],
  INDIVIDUAL_ANNUAL: ['price_...'],
  PRO_MONTHLY: ['price_...'],
  PRO_ANNUAL: ['price_...'],
} as const;

export const PRICING_CONFIG = {
  // Credits system
  credits: {
    perGeneration: 4,
    rollover: true,
    rolloverLimit: null, // unlimited rollover
  },
  
  // Try Once (one-time purchase)
  tryOnce: {
    price: 5.00,
    credits: 4,
    stripePriceIds: PRICE_IDS.TRY_ONCE,
    stripePriceId: PRICE_IDS.TRY_ONCE[0] || '',
  },
  
  // Individual tier
  individual: {
    monthly: {
      price: 24.00,
      includedCredits: 100,
      stripePriceIds: PRICE_IDS.INDIVIDUAL_MONTHLY,
      stripePriceId: PRICE_IDS.INDIVIDUAL_MONTHLY[0] || '',
    },
    annual: {
      price: 245.00,
      includedCredits: 100, // per month
      stripePriceIds: PRICE_IDS.INDIVIDUAL_ANNUAL,
      stripePriceId: PRICE_IDS.INDIVIDUAL_ANNUAL[0] || '',
    },
    topUp: {
      pricePerPackage: 0.90,
      creditsPerPackage: 4,
      minimumPurchase: 20,
    },
  },
  
  // Pro tier
  pro: {
    monthly: {
      price: 59.00,
      includedCredits: 280,
      stripePriceIds: PRICE_IDS.PRO_MONTHLY,
      stripePriceId: PRICE_IDS.PRO_MONTHLY[0] || '',
    },
    annual: {
      price: 600.00,
      includedCredits: 280, // per month
      stripePriceIds: PRICE_IDS.PRO_ANNUAL,
      stripePriceId: PRICE_IDS.PRO_ANNUAL[0] || '',
    },
    topUp: {
      pricePerPackage: 0.60,
      creditsPerPackage: 4,
      minimumPurchase: 20,
    },
  },
  
  // Cost tracking
  costs: {
    geminiApiPerGeneration: 0.10,
  },
}

// Helper functions
export function getCreditsForTier(tier: 'individual' | 'pro', period: 'monthly' | 'annual') {
  return PRICING_CONFIG[tier][period].includedCredits
}

export function getTopUpPrice(tier: 'individual' | 'pro') {
  return PRICING_CONFIG[tier].topUp.pricePerPackage
}

export function formatCreditsDisplay(credits: number) {
  const generations = Math.floor(credits / PRICING_CONFIG.credits.perGeneration)
  return `${credits} credits (${generations} generations)`
}
```

Configure Stripe Price IDs:
- Define your Price IDs directly in `src/config/pricing.ts` under the `PRICE_IDS` object.
- You can keep multiple IDs per tier (arrays) if you need sandbox/production or legacy prices.
- The first entry is used as the default `stripePriceId` when a single ID is required.

---

## Step 6: Configure Auth.js

### Create Auth.js Configuration

**MVP: Email/Password Only (OAuth post-launch)**

Create `lib/auth.ts`:
```typescript
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })
        
        if (!user || !user.password) {
          return null
        }
        
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        
        if (!isValid) {
          return null
        }
        
        return user
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.locale = token.locale as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.locale = user.locale
      }
      return token
    }
  }
})
```

### Create Auth API Route

Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

### Add OAuth Later (Post-MVP)

When ready to add OAuth:
1. Install providers: Google, GitHub
2. Set up OAuth apps in Google Console / GitHub
3. Add provider configurations to auth config
4. Update environment variables
5. Test OAuth flow

For now, email/password is sufficient for 2-week launch.

### Authentication UX Requirements

**OTP Resend Throttling:**
- Server-side throttling: 30 seconds per email
- Show visible cooldown timer + success message when new code is sent

**Magic Link Verification:**
- Verify screen displays destination email when available (e.g., `?email=`)
- Clear user feedback for verification status

**Client Events:**
- Emit lightweight events for signin success/error
- Emit events for magic-link send/error
- Events can be wired to analytics later

---

## Step 7: Configure next-intl

### Create i18n Configuration

Create `i18n.ts`:
```typescript
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound()
  
  return {
    messages: (await import(`./messages/${locale}.json`)).default
  }
})
```

### Create Translation Files

Create `messages/en.json`:
```json
{
  "brand": {
    "name": "TeamShots",
    "tagline": "Professional team photos in 60 seconds"
  },
  "common": {
    "login": "Log In",
    "signup": "Sign Up",
    "logout": "Log Out",
    "credits": "Credits"
  },
  "landing": {
    "hero": "Professional team photos in 60 seconds",
    "cta": "Get Started"
  },
  "dashboard": {
    "title": "Dashboard",
    "generate": "Generate New Photo",
    "history": "History"
  },
  "generation": {
    "upload": "Upload Photo",
    "selectStyle": "Select Style",
    "generating": "Generating your photos...",
    "cost": "This will use {credits} credits"
  }
}
```

Create `messages/es.json`:
```json
{
  "brand": {
    "name": "TeamShots",
    "tagline": "Fotos de equipo profesionales en 60 segundos"
  },
  "common": {
    "login": "Iniciar Sesión",
    "signup": "Registrarse",
    "logout": "Cerrar Sesión",
    "credits": "Créditos"
  },
  "landing": {
    "hero": "Fotos de equipo profesionales en 60 segundos",
    "cta": "Comenzar"
  },
  "dashboard": {
    "title": "Panel",
    "generate": "Generar Nueva Foto",
    "history": "Historial"
  },
  "generation": {
    "upload": "Subir Foto",
    "selectStyle": "Seleccionar Estilo",
    "generating": "Generando tus fotos...",
    "cost": "Esto usará {credits} créditos"
  }
}
```

### Configure Middleware

Create `middleware.ts`:
```typescript
import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localeDetection: true // Auto-detect from browser
})

export default function middleware(request: NextRequest) {
  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
```

### Update next.config.js

```javascript
const withNextIntl = require('next-intl/plugin')('./i18n.ts')

module.exports = withNextIntl({
  // Your Next.js config
})
```

### Create Language Switcher Component

Create `components/LanguageSwitcher.tsx`:
```typescript
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  
  const switchLocale = (newLocale: string) => {
    // Update user preference in database if logged in
    fetch('/api/user/locale', {
      method: 'POST',
      body: JSON.stringify({ locale: newLocale })
    })
    
    // Navigate to new locale
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }
  
  return (
    <select 
      value={locale}
      onChange={(e) => switchLocale(e.target.value)}
      className="border rounded px-2 py-1"
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  )
}
```

### Update Root Layout

Update `app/[locale]/layout.tsx`:
```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const messages = await getMessages()
  
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

---

## Step 8: Understanding Docker (Simple Explanation)

**What is Docker?**
Think of Docker as a "box" that contains your entire app (code + Node.js + dependencies). This box runs the same way on your computer, on Hetzner, everywhere.

**Why do you need it?**
- Your app works the same locally and in production
- Coolify needs it to deploy your app
- Easy rollbacks if something breaks

**Do you need to learn Docker?**
Not really. You just need one file (`Dockerfile`) and Coolify does the rest.

### Create Dockerfile

Create `Dockerfile` in your project root:

```dockerfile
# Use Node.js 18 (lightweight Alpine version)
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all your code
COPY . .

# Build Next.js for production
RUN npm run build

# Expose port 3000 (where Next.js runs)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
```

**That's it!** You never need to touch Docker again. Coolify uses this file to build and run your app.

### Create .dockerignore
```
node_modules
.next
.env.local
.git
```

---

## Step 9: Test Locally

### Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

**Test internationalization:**
- Visit http://localhost:3000 (English - default)
- Visit http://localhost:3000/es (Spanish)
- Browser auto-detection should work

**Test authentication:**
- Visit http://localhost:3000/auth/signin
- Try OAuth providers (Google, GitHub)
- Try email/password signup
- Check session persistence

### Test Database Connection
```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

### Test Docker Build (Optional)
```bash
# Build Docker image locally
docker build -t team-photo-ai .

# Run container
docker run -p 3000:3000 team-photo-ai
```

If this works, Coolify will work.

---

## Step 10: Deploy to Hetzner with Coolify

### 10.1 Set Up Hetzner Server

1. **Create Hetzner Account** → https://hetzner.com
2. **Create VPS:**
   - Go to Cloud Console
   - Click "Add Server"
   - Location: Your choice (Germany recommended)
   - Type: CPX31 (4 vCPU, 8GB RAM) - €15/month
   - Image: Ubuntu 22.04
   - Add SSH key (if you have one)
   - Create & Start

3. **Note your server IP:** e.g., `123.45.67.89`

### 10.2 Install Coolify on Hetzner

**Option A: Use Coolify Cloud (Easiest)**
1. Go to https://app.coolify.io
2. Sign up for Coolify Cloud account
3. Connect your Hetzner server (follow their wizard)
4. Coolify Cloud manages everything

**Option B: Self-hosted Coolify (More control)**
1. SSH into your Hetzner server:
   ```bash
   ssh root@123.45.67.89
   ```

2. Install Coolify:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

3. Access Coolify at: `http://123.45.67.89:8000`

### 10.3 Connect GitHub Repository

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/team-photo-ai.git
   git push -u origin main
   ```

2. **In Coolify:**
   - Click "New Resource"
   - Select "Application"
   - Connect GitHub account
   - Select your repository
   - Branch: `main`
   - Build Pack: "Docker" (Coolify auto-detects Dockerfile)

### 10.4 Configure Environment Variables

In Coolify dashboard:
1. Go to your app → "Environment Variables"
2. Add all variables from your `.env.local`
3. **Important:** Use production values, not local ones
4. Update `DATABASE_URL` to point to Hetzner database

### 10.5 Set Up Database on Hetzner

**Option A: Database on same VPS**
1. In Coolify: "New Resource" → "Database" → "PostgreSQL"
2. Coolify creates database container
3. Copy connection string to your app's `DATABASE_URL`

**Option B: Managed Database**
1. Hetzner Cloud → Create "Managed PostgreSQL"
2. Copy connection string
3. Add to app's environment variables

### 10.6 Deploy

1. Click "Deploy" in Coolify
2. Coolify will:
   - Clone your repo
   - Build Docker image (2-3 minutes)
   - Start container
   - Assign URL

3. Your app is live! 🎉

### 10.7 Set Up Custom Domains

**Two domains required (see Infrastructure doc):**
- www.teamshots.vip (marketing site)
- app.teamshots.vip (application)

1. **In your domain registrar (Namecheap, Cloudflare, etc.):**
   - Add A record: `www` → `123.45.67.89` (your Hetzner IP)
   - Add A record: `app` → `123.45.67.89` (same Hetzner IP)

2. **In Coolify:**
   - Go to app → "Domains"
   - Add both domains: `www.teamshots.vip` and `app.teamshots.vip`
   - Enable "Generate SSL Certificate" for each (automatic HTTPS)

3. **Configure Next.js routing:**
   - Marketing pages (`/`, `/pricing`) → www.teamshots.vip
   - App pages (`/dashboard`, etc.) → app.teamshots.vip

Wait 5-10 minutes for DNS propagation. Done!

---

## Step 11: Set Up External Services

### Gemini API
1. Go to https://ai.google.dev/
2. Sign in with Google account
3. Go to "Get API Key"
4. Create new API key
5. Add to environment variables: `GEMINI_API_KEY`
6. Enable billing if needed (has free tier for testing)

**Model:** Gemini 2.5 Flash (aka "Nano Banana") for image generation

**Why direct API?**
- 30-50% cheaper than Replicate or other intermediaries
- Direct access to latest features
- Simpler architecture
- Better cost tracking for profitability

### Hetzner Object Storage (S3)
1. Hetzner Cloud Console → "Object Storage"
2. Create bucket: `team-photos`
3. Generate access keys
4. Add credentials to environment variables

### Stripe
1. https://stripe.com → Create account
2. Get API keys (Dashboard → Developers → API Keys)
3. **Create products in Stripe:**
   - Try Once: $5 one-time
   - Starter Monthly: $24 recurring monthly
   - Starter Annual: $245 recurring yearly
   - Pro Monthly: $59 recurring monthly
   - Pro Annual: $600 recurring yearly
4. Copy Price IDs to `.env.local`
5. Add webhook endpoint: `https://app.teamshots.vip/api/stripe/webhook`
6. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
7. Add webhook secret to environment variables

**Note:** Top-ups are handled dynamically via Stripe Checkout, not as fixed products.

### Translations (Machine Translation for Beta)

**English (en.json):** Write manually
**Spanish (es.json):** Use machine translation for MVP (improve with native speaker post-beta)

Tools for machine translation:
- DeepL (recommended for quality)
- Google Translate
- ChatGPT for JSON file translation

Post-beta: Hire native Spanish speaker to review and improve translations.

### Email Service
**Resend (Recommended):**
1. https://resend.com → Sign up
2. Get API key
3. Add sending domain
4. Add to environment variables

**Important:** All email templates must support EN/ES:
- Welcome emails
- Password reset
- Credit purchase confirmations
- Generation notifications

Create email templates with react-email:
```typescript
// emails/welcome.tsx
import { useTranslations } from 'next-intl'

export function WelcomeEmail({ locale }: { locale: string }) {
  const t = useTranslations('emails.welcome')
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('message')}</p>
    </div>
  )
}
```

---

## Step 12: Your First Feature

### Install Gemini SDK

```bash
npm install @google/generative-ai
```

### Create Image Generator Service

Create `lib/gemini.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateTeamPhoto(
  imageUrl: string,
  stylePreset: string,
  backgroundOption: string
) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  
  const prompt = `Transform this photo into a professional team photo.
Style: ${stylePreset}
Background: ${backgroundOption}
Maintain the person's likeness while making it professional and polished.`
  
  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { 
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageUrl // Base64 or URL
            }
          }
        ]
      }]
    })
    
    // Extract generated image
    const response = await result.response
    const imageData = response.text() // This will be the generated image
    
    return imageData
  } catch (error) {
    console.error('Gemini generation failed:', error)
    throw error
  }
}

// Generate 4 variations
export async function generateVariations(
  imageUrl: string,
  stylePreset: string,
  backgroundOption: string
) {
  const variations = await Promise.all([
    generateTeamPhoto(imageUrl, stylePreset, backgroundOption),
    generateTeamPhoto(imageUrl, stylePreset, backgroundOption),
    generateTeamPhoto(imageUrl, stylePreset, backgroundOption),
    generateTeamPhoto(imageUrl, stylePreset, backgroundOption),
  ])
  
  return variations
}
```

### Create Generation API Endpoint

Create `app/api/generate/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateVariations } from '@/lib/gemini'
import { uploadToS3 } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { imageUrl, stylePreset, backgroundOption } = await request.json()
    
    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!user || user.credits < 4) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }
    
    // Generate variations
    const variations = await generateVariations(imageUrl, stylePreset, backgroundOption)
    
    // Upload variations to S3
    const uploadedUrls = await Promise.all(
      variations.map(img => uploadToS3(img, `generated/${Date.now()}`))
    )
    
    // Save to database
    const generation = await prisma.generation.create({
      data: {
        userId: session.user.id,
        uploadedPhotoUrl: imageUrl,
        stylePreset,
        backgroundOption,
        variations: uploadedUrls,
        creditsUsed: 4,
        actualCost: 0.10, // Track actual cost for profitability
        provider: 'gemini',
        status: 'completed',
      }
    })
    
    // Deduct credits
    await prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: 4 } }
    })
    
    // Record transaction
    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: 'generation',
        amount: 0,
        creditsDelta: -4,
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      generation,
      variations: uploadedUrls 
    })
  } catch (error) {
    console.error('Generation failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
```

### Create Simple Upload Endpoint

`app/api/upload/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.HETZNER_S3_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.HETZNER_S3_ACCESS_KEY!,
    secretAccessKey: process.env.HETZNER_S3_SECRET_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File;
    
    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${Date.now()}-${file.name}`;
    
    await s3.send(new PutObjectCommand({
      Bucket: process.env.HETZNER_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));
    
    const url = `${process.env.HETZNER_S3_ENDPOINT}/${process.env.HETZNER_S3_BUCKET}/${key}`;
    
    return NextResponse.json({ success: true, url });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

### Test It
```bash
curl -X POST -F "photo=@test.jpg" http://localhost:3000/api/upload
```

---

## Step 13: Development Workflow

### Code Quality Principles

**Configuration over code:**
- Add new values to `config/` files, not hard-coded
- Business logic in `/lib`, UI in `/components`, config in `/config`
- Type everything with TypeScript
- Abstract external services for easy swapping
- No business logic in components

**Speed vs. Quality for 2-week timeline:**
- Use basic Tailwind components (polish UI later)
- Start with email/password auth (add OAuth later if needed)
- Minimal email templates (improve later)
- Basic error handling (enhance later)
- Focus on core functionality first

### Daily Development
```bash
# 1. Pull latest code
git pull

# 2. Install any new dependencies
npm install

# 3. Run dev server
npm run dev

# 4. Make changes

# 5. Push to GitHub
git add .
git commit -m "Add feature X"
git push

# 6. Coolify auto-deploys (if main branch)
```

### Database Changes
```bash
# 1. Update schema in prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Push to GitHub

# 4. In Coolify, run migration on production:
# SSH into server or use Coolify console:
npx prisma migrate deploy
```

---

## Common Issues & Solutions

### "Docker build failed"
- Check Dockerfile syntax
- Ensure all dependencies are in package.json
- Check Coolify build logs

### "Database connection failed"
- Verify DATABASE_URL is correct
- Check database is running
- Check firewall rules

### "Upload to S3 failed"
- Verify Hetzner S3 credentials
- Check bucket permissions
- Ensure bucket exists

### "Gemini API error"
- Check API key is valid
- Check quota/rate limits
- Verify API is enabled

---

## Next Steps

Once basic setup works:

1. **Build authentication** (signup/login)
2. **Implement credit system**
3. **Integrate Gemini API** for generation
4. **Add Stripe payments**
5. **Create UI components**
6. **Add email notifications**
7. **Test end-to-end**
8. **Beta launch**
