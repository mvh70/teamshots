/**
 * Debug utility to check S3 configuration
 * This helps verify which S3 provider is being used
 * 
 * Usage: Add this to an API route temporarily to check config
 */

import { getS3Config, getS3Folder } from './s3-client'

export function debugS3Config() {
  const config = getS3Config()
  const folder = getS3Folder()
  
  // Check which env vars are being used
  const usingNewVars = !!(
    process.env.S3_ENDPOINT ||
    process.env.S3_ACCESS_KEY_ID ||
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.S3_BUCKET_NAME ||
    process.env.S3_REGION ||
    process.env.S3_FOLDER
  )
  
  const usingLegacyVars = !!(
    process.env.HETZNER_S3_ENDPOINT ||
    process.env.HETZNER_S3_ACCESS_KEY ||
    process.env.HETZNER_S3_SECRET_KEY ||
    process.env.HETZNER_S3_BUCKET ||
    process.env.HETZNER_S3_REGION
  )
  
  // Determine provider from endpoint
  let provider = 'Unknown'
  if (config.endpoint) {
    if (config.endpoint.includes('backblazeb2.com')) {
      provider = 'Backblaze B2'
    } else if (config.endpoint.includes('hetzner')) {
      provider = 'Hetzner'
    } else if (config.endpoint.includes('amazonaws.com')) {
      provider = 'AWS S3'
    } else {
      provider = 'Other S3-compatible'
    }
  }
  
  return {
    provider,
    usingNewVars,
    usingLegacyVars,
    config: {
      endpoint: config.endpoint ? `${config.endpoint.substring(0, 30)}...` : 'Not set',
      bucket: config.bucket ? `${config.bucket.substring(0, 10)}...` : 'Not set',
      region: config.region || 'Not set',
      folder: folder || 'Not set (files stored at root)',
      hasCredentials: !!(config.accessKeyId && config.secretAccessKey),
    },
    envVars: {
      S3_ENDPOINT: !!process.env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: !!process.env.S3_SECRET_ACCESS_KEY,
      S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
      S3_REGION: !!process.env.S3_REGION,
      S3_FOLDER: !!process.env.S3_FOLDER,
      HETZNER_S3_ENDPOINT: !!process.env.HETZNER_S3_ENDPOINT,
      HETZNER_S3_ACCESS_KEY: !!process.env.HETZNER_S3_ACCESS_KEY,
      HETZNER_S3_SECRET_KEY: !!process.env.HETZNER_S3_SECRET_KEY,
      HETZNER_S3_BUCKET: !!process.env.HETZNER_S3_BUCKET,
      HETZNER_S3_REGION: !!process.env.HETZNER_S3_REGION,
    }
  }
}

