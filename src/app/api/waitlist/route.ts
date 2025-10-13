import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendWaitlistWelcomeEmail } from '@/lib/email';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  locale: z.enum(['en', 'es']).optional().default('en'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate email and locale
    const { email, locale } = emailSchema.parse(body);
    
    // Check for duplicates in database
    const existingSignup = await prisma.waitlistSignup.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existingSignup) {
      return NextResponse.json(
        { 
          success: false, 
          message: "You're already on the waitlist! We'll notify you when we launch." 
        },
        { status: 200 }
      );
    }
    
    // Add to waitlist database
    await prisma.waitlistSignup.create({
      data: {
        email: email.toLowerCase(),
        source: 'landing-page',
      },
    });
    
    // Send welcome email
    const emailResult = await sendWaitlistWelcomeEmail({
      email: email.toLowerCase(),
      locale,
    });
    
    if (!emailResult.success) {
      // Log error but don't fail the request
      console.error('Failed to send welcome email:', emailResult.error);
    }
    
    console.log(`New waitlist signup: ${email} (locale: ${locale})`);
    
    return NextResponse.json({
      success: true,
      message: "Thanks for joining! Check your email for confirmation.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error('Waitlist signup error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint to view waitlist (admin only - add auth later)
export async function GET() {
  const signups = await prisma.waitlistSignup.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  return NextResponse.json({
    total: signups.length,
    signups: signups.map((s) => ({
      email: s.email,
      timestamp: s.createdAt,
      notified: s.notified,
    })),
  });
}

