import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Logger } from '@/lib/logger';
import { Env } from '@/lib/env'
import { getRequestHeader } from '@/lib/server-headers'

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, priceId } = body;

    // Call the actual checkout endpoint
    const response = await fetch(`${Env.string('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': (await getRequestHeader('cookie')) || '',
      },
      body: JSON.stringify({ type, priceId }),
    });

    const data = await response.json();
    
    if (data.checkoutUrl) {
      return NextResponse.json({ 
        checkoutUrl: data.checkoutUrl,
        message: 'Open this URL in your browser to test checkout'
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    Logger.error('Test Stripe error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create test checkout' },
      { status: 500 }
    );
  }
}
