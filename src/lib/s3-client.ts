import { S3Client } from '@aws-sdk/client-s3'
import { Env } from '@/lib/env'

/**
 * Get S3 configuration from environment variables.
 * Supports both new generic S3_* vars and legacy HETZNER_S3_* vars for backward compatibility.
 */
export function getS3Config() {
  // Prefer new generic S3_* env vars, fallback to legacy HETZNER_S3_* vars
  const endpoint = Env.string(
    'S3_ENDPOINT',
    Env.string('HETZNER_S3_ENDPOINT', '')
  )
  const accessKeyId = Env.string(
    'S3_ACCESS_KEY_ID',
    Env.string('HETZNER_S3_ACCESS_KEY', '')
  )
  const secretAccessKey = Env.string(
    'S3_SECRET_ACCESS_KEY',
    Env.string('HETZNER_S3_SECRET_KEY', '')
  )
  const bucket = Env.string(
    'S3_BUCKET_NAME',
    Env.string('HETZNER_S3_BUCKET', '')
  )
  const region = Env.string(
    'S3_REGION',
    Env.string('HETZNER_S3_REGION', 'us-east-1')
  )
  const folder = Env.string('S3_FOLDER', '')

  // Resolve endpoint: ensure it has protocol
  const resolvedEndpoint = endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
    ? endpoint
    : endpoint
      ? `https://${endpoint}`
      : undefined

  return {
    endpoint: resolvedEndpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
    folder: folder ? folder.replace(/^\/+|\/+$/g, '') : '', // Remove leading/trailing slashes
  }
}

/**
 * Create a configured S3Client instance.
 * @param options - Optional configuration overrides
 */
export function createS3Client(options?: {
  forcePathStyle?: boolean
  region?: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }
}) {
  const config = getS3Config()

  return new S3Client({
    region: options?.region || config.region,
    endpoint: options?.endpoint || config.endpoint,
    credentials: {
      accessKeyId: options?.credentials?.accessKeyId || config.accessKeyId || '',
      secretAccessKey: options?.credentials?.secretAccessKey || config.secretAccessKey || '',
    },
    forcePathStyle: options?.forcePathStyle ?? false,
  })
}

/**
 * Get the S3 bucket name from environment variables.
 */
export function getS3BucketName(): string {
  const config = getS3Config()
  return config.bucket
}

/**
 * Get the S3 folder/prefix from environment variables.
 * Returns empty string if not set.
 */
export function getS3Folder(): string {
  const config = getS3Config()
  return config.folder
}

/**
 * Sanitize a name for use in S3 keys.
 * Removes special characters, converts to lowercase, and replaces spaces with hyphens.
 * 
 * @param name - The name to sanitize
 * @returns Sanitized name safe for S3 keys
 */
export function sanitizeNameForS3(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric (except hyphens) with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    || 'unknown' // Fallback if name is empty after sanitization
}

/**
 * Prepend the S3 folder prefix to a key if folder is configured.
 * Example: if folder is "dev" and key is "selfies/123/abc.jpg"
 * Returns: "dev/selfies/123/abc.jpg"
 * 
 * @param key - The S3 key (without folder prefix)
 * @returns The full S3 key with folder prefix if configured
 */
export function getS3Key(key: string): string {
  const folder = getS3Folder()
  if (!folder) {
    return key
  }
  // Ensure no double slashes
  return `${folder}/${key}`.replace(/\/+/g, '/')
}

/**
 * Get a default S3Client instance (for most use cases).
 */
export const s3Client = createS3Client()

