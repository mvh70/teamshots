import { NextRequest, NextResponse } from 'next/server'
import { getRequestHeader } from '@/lib/server-headers'

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.teamshotspro.com',
  'https://www.teamshotspro.com',
]

export async function corsMiddleware(request: NextRequest, response: NextResponse) {
  const origin = await getRequestHeader('origin')
  
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')
  
  return response
}
