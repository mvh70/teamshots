import { Resend } from 'resend';
import WaitlistWelcomeEmail from '@/emails/WaitlistWelcome';
import { BRAND_CONFIG } from '@/config/brand';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration - uses brand config for consistency
const FROM_EMAIL = `${BRAND_CONFIG.name} <${BRAND_CONFIG.contact.hello}>`;
const REPLY_TO_EMAIL = BRAND_CONFIG.contact.support;

interface SendWaitlistWelcomeEmailParams {
  email: string;
  locale?: 'en' | 'es';
}

/**
 * Send welcome email to waitlist signups
 */
export async function sendWaitlistWelcomeEmail({
  email,
  locale = 'en',
}: SendWaitlistWelcomeEmailParams) {
  try {
    const subject = locale === 'es' 
      ? "¡Bienvenido a TeamShots! 🎉"
      : "Welcome to TeamShots! 🎉";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      react: WaitlistWelcomeEmail({ email, locale }),
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error };
    }

    console.log('Welcome email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

/**
 * Send notification email to waitlist when launching
 */
export async function sendWaitlistLaunchEmail({
  email,
  locale = 'en',
  discountCode,
}: {
  email: string;
  locale?: 'en' | 'es';
  discountCode?: string;
}) {
  // TODO: Implement launch notification email
  // This will be used when we're ready to notify waitlist
  console.log('Launch email not yet implemented', { email, locale, discountCode });
  return { success: false, error: 'Not implemented' };
}

