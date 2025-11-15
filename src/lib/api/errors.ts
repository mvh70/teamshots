import { NextResponse } from 'next/server'

/**
 * Standardized error response utilities for API routes
 * Ensures consistent error format across all endpoints
 */

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

/**
 * Returns a 401 Unauthorized response
 */
export function unauthorized(message: string = 'Unauthorized', code?: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status: 401 }
  )
}

/**
 * Returns a 403 Forbidden response
 */
export function forbidden(message: string = 'Forbidden', code?: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status: 403 }
  )
}

/**
 * Returns a 404 Not Found response
 */
export function notFound(message: string = 'Not found', code?: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status: 404 }
  )
}

/**
 * Returns a 400 Bad Request response
 */
export function badRequest(message: string = 'Bad request', code?: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code, details },
    { status: 400 }
  )
}

/**
 * Returns a 500 Internal Server Error response
 */
export function internalError(message: string = 'Internal server error', code?: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status: 500 }
  )
}

/**
 * Returns a 429 Too Many Requests response
 */
export function tooManyRequests(message: string = 'Too many requests', code?: string, retryAfter?: number): NextResponse<ApiError> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  }
  
  if (retryAfter !== undefined) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return NextResponse.json(
    { error: message, code },
    { status: 429, headers }
  )
}

/**
 * Returns a 402 Payment Required response
 */
export function paymentRequired(message: string = 'Payment required', code?: string): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, code },
    { status: 402 }
  )
}

