import { z } from 'zod'
import validator from 'validator'

// SECURITY: Standardized bcrypt cost factor for all password hashing
// Cost factor 12 provides ~250ms hashing time on modern hardware
// This should be used consistently across all password operations
export const BCRYPT_COST_FACTOR = 12

// Email validation (stricter than Zod default)
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .refine((email) => validator.isEmail(email), 'Invalid email')

// Password requirements - SECURITY: NIST SP 800-63B recommends minimum 8 characters
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')

// Name validation (basic security)
export const nameSchema = z.string()
  .min(1, 'Name required')
  .max(100, 'Name too long')
  .refine((name) => /^[a-zA-Z\s\-'\.]+$/.test(name), 'Invalid characters in name')

// Registration schema (with basic validation)
// Supports both normal signup (with password) and guest checkout (no password, user already exists)
// Note: userType is determined server-side from domain, not accepted from client
export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(), // Optional for guest checkout
  firstName: nameSchema.optional(), // Optional for guest checkout (name already set by webhook)
  lastName: nameSchema.optional(),
  teamWebsite: z.string().optional().refine(
    (val) => !val || z.string().url().safeParse(val).success,
    'Invalid website URL'
  ),
  otpCode: z.string().length(6).regex(/^\d{6}$/, 'Invalid OTP format'),
  locale: z.enum(['en', 'es']).default('en'),
  guestCheckout: z.boolean().optional(), // Flag for guest checkout flow
}).refine(
  (data) => data.guestCheckout || (data.password && data.firstName),
  { message: 'Password and firstName are required for normal signup' }
)

// Sanitize HTML (simple server-side version)
export function sanitizeHtml(input: string): string {
  // Simple sanitization: remove all HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, '') // Remove dangerous characters
    .trim()
}

// Sanitize filename
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 255)
}

// Additional validation schemas for security
export const idSchema = z.string().uuid('Invalid ID format')
export const positiveIntSchema = z.number().int().positive('Must be a positive integer')
export const nonEmptyStringSchema = z.string().min(1, 'String cannot be empty').max(1000, 'String too long')
export const urlSchema = z.string().url('Invalid URL format')
export const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+=*$/, 'Invalid base64 format')
export const s3KeySchema = z.string().min(1).max(1024).regex(/^[a-zA-Z0-9/._-]+$/, 'Invalid S3 key format')

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*[a-zA-Z0-9]$/, 'Invalid content type'),
  size: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
})

// Generation request validation
export const generationRequestSchema = z.object({
  contextId: idSchema.optional(),
  style: z.string().min(1).max(100),
  prompt: z.string().min(1).max(1000),
  originalGenerationId: idSchema.optional(),
})