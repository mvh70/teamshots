import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
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
    console.error('Test Stripe error:', error);
    return NextResponse.json(
      { error: 'Failed to create test checkout' },
      { status: 500 }
    );
  }
}
