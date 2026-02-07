import { z } from 'zod'
import { Logger } from '@/lib/logger'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Email
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().email().optional().default('noreply@teamshotspro.com'),
  
  // AWS/Hetzner S3 (optional, for backward compatibility)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // S3 Storage Configuration (generic, works with any S3-compatible provider)
  // Supports Backblaze B2, Hetzner, AWS S3, etc.
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_FOLDER: z.string().optional(), // Optional folder prefix (e.g., "dev", "production", "localhost")
  
  // Hetzner S3 (legacy, for backward compatibility)
  HETZNER_S3_ENDPOINT: z.string().optional(),
  HETZNER_S3_BUCKET: z.string().optional(),
  HETZNER_S3_REGION: z.string().optional(),
  HETZNER_S3_ACCESS_KEY: z.string().optional(),
  HETZNER_S3_SECRET_KEY: z.string().optional(),
  
  // Gemini AI
  GEMINI_IMAGE_MODEL: z.string().optional(),
  GEMINI_EVAL_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),  // Alias for GOOGLE_CLOUD_API_KEY (for REST API)
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_CLOUD_API_KEY: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_MARKETING_URL: z.string().url().optional(),
  
  // Redis (optional)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().regex(/^\d+$/).optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // PostHog Analytics
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']),

  // Force specific domain for local testing (localhost only)
  // This controls both brand/landing AND signup type
  // Example: 'portreya.com' (individual) or 'teamshotspro.com' (team)
  NEXT_PUBLIC_FORCE_DOMAIN: z.string().optional(),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production' && data.NEXTAUTH_URL) {
      return data.NEXTAUTH_URL.startsWith('https://');
    }
    return true;
  },
  {
    message: 'NEXTAUTH_URL must start with https:// in production.',
    path: ['NEXTAUTH_URL'],
  }
).refine(
  (data) => {
    const authPairIsValid = (!!data.AUTH_GOOGLE_ID && !!data.AUTH_GOOGLE_SECRET) || (!data.AUTH_GOOGLE_ID && !data.AUTH_GOOGLE_SECRET);
    const googlePairIsValid = (!!data.GOOGLE_CLIENT_ID && !!data.GOOGLE_CLIENT_SECRET) || (!data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET);
    return authPairIsValid && googlePairIsValid;
  },
  {
    message: 'If set, Google OAuth credentials must be provided as complete pairs: AUTH_GOOGLE_ID+AUTH_GOOGLE_SECRET or GOOGLE_CLIENT_ID+GOOGLE_CLIENT_SECRET.',
    path: ['AUTH_GOOGLE_ID'],
  }
).refine(
  (data) => {
    // Ensure at least one Gemini AI authentication method is configured
    const hasApiKey = !!data.GOOGLE_CLOUD_API_KEY || !!data.GEMINI_API_KEY;
    const hasServiceAccount = !!data.GOOGLE_APPLICATION_CREDENTIALS || !!data.GOOGLE_PROJECT_ID;
    const hasOpenRouter = !!data.OPENROUTER_API_KEY;
    return hasApiKey || hasServiceAccount || hasOpenRouter;
  },
  {
    message: 'Configure one of: OPENROUTER_API_KEY (preferred), GOOGLE_CLOUD_API_KEY/GEMINI_API_KEY, or both GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_PROJECT_ID for Gemini AI access.',
    path: ['OPENROUTER_API_KEY'],
  }
);

export function validateEnvironment() {
  const result = envSchema.safeParse(process.env)
  
  if (!result.success) {
    Logger.error('Invalid environment variables', { issues: result.error.format() })
    throw new Error('Environment validation failed')
  }
  
  return result.data
}
