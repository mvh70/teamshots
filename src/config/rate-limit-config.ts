// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
  // Authentication endpoints
  register: { limit: 5, window: 900 }, // 5 attempts per 15 minutes
  signin: { limit: 10, window: 900 }, // 10 attempts per 15 minutes
  otp: { limit: 3, window: 300 }, // 3 attempts per 5 minutes
  
  // File upload endpoints
  upload: { limit: 10, window: 300 }, // 10 uploads per 5 minutes
  
  // API endpoints
  api: { limit: 100, window: 60 }, // 100 requests per minute

  // File retrieval endpoints (protect /api/files/get)
  filesGet: { limit: 60, window: 1  }, // 60 image fetches per minute per identifier
  
  // Generation endpoints
  generation: { limit: 10, window: 300 }, // 10 generations per 5 minutes
  
  // Password reset
  passwordReset: { limit: 3, window: 3600 }, // 3 attempts per hour

  // Team invite public endpoints
  inviteValidate: { limit: 100, window: 1 }, // 15 validations per minute per IP
  inviteAccept: { limit: 10, window: 60 }, // 10 accepts per minute per IP
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

// Temporary IP block thresholds (sliding window) for sensitive public flows
export const RATE_BLOCK = {
  // If an IP hits 50 attempts within 5 minutes on invite flows, block 15 minutes
  invite: { limit: 50, window: 300, blockSeconds: 900 },
} as const

export type RateBlockKey = keyof typeof RATE_BLOCK
