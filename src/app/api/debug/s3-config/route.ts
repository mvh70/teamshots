import { NextResponse } from 'next/server'
import { debugS3Config } from '@/lib/debug-s3-config'

export async function GET() {
  const debugConfig = debugS3Config()
  return NextResponse.json(debugConfig)
}

