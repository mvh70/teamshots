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
  
  // Generation endpoints
  generation: { limit: 10, window: 300 }, // 10 generations per 5 minutes
  
  // Password reset
  passwordReset: { limit: 3, window: 3600 }, // 3 attempts per hour
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS
