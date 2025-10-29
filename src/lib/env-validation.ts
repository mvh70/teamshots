import { z } from 'zod'
import { Logger } from '@/lib/logger'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  
  // Email
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().email().optional().default('noreply@teamshots.vip'),
  
  // AWS/Hetzner S3 (optional, for backward compatibility)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // Hetzner S3
  HETZNER_S3_ENDPOINT: z.string().optional(),
  HETZNER_S3_BUCKET: z.string().optional(),
  HETZNER_S3_REGION: z.string().optional(),
  HETZNER_S3_ACCESS_KEY: z.string().optional(),
  HETZNER_S3_SECRET_KEY: z.string().optional(),
  
  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_MODEL: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().optional(),
  AI_TIMEOUT: z.string().optional(),
  AI_MAX_RETRIES: z.string().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
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
);

export function validateEnvironment() {
  const result = envSchema.safeParse(process.env)
  
  if (!result.success) {
    Logger.error('Invalid environment variables', { issues: result.error.format() })
    throw new Error('Environment validation failed')
  }
  
  return result.data
}
