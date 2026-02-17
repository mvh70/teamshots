import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ok, badRequest, internal } from '@/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { sendSupportNotificationEmail } from '@/lib/email';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const identifier = await getRateLimitIdentifier(request, 'contact');
    const limit = await checkRateLimit(identifier, 5, 3600);

    if (!limit.success) {
      return NextResponse.json(
        badRequest('RATE_LIMITED', 'contact.form.rateLimited'),
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        badRequest('INVALID_INPUT', undefined, parsed.error.issues[0]?.message),
        { status: 400 }
      );
    }

    const { name, email, subject, message } = parsed.data;

    await sendSupportNotificationEmail({
      subject: `Contact Form: ${subject}`,
      message: `From: ${name} <${email}>\n\n${message}`,
      metadata: { name, email, source: 'contact-form' },
    });

    Logger.info('Contact form submitted', { email, subject });

    return NextResponse.json(ok(undefined, 'CONTACT_SENT'));
  } catch (error) {
    Logger.error('Contact form error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(internal('Something went wrong'), { status: 500 });
  }
}
