import { Resend } from 'resend';
import WaitlistWelcomeEmail from '@/emails/WaitlistWelcome';
import TeamInviteEmail from '@/emails/TeamInvite';
import { BRAND_CONFIG } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';

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
    const subject = getEmailTranslation('waitlistWelcome.subject', locale);

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

interface SendOTPEmailParams {
  email: string;
  code: string;
  locale?: 'en' | 'es';
}

/**
 * Send OTP verification email
 */
export async function sendOTPEmail({
  email,
  code,
  locale = 'en',
}: SendOTPEmailParams) {
  try {
    const subject = locale === 'es' 
      ? "Código de verificación TeamShots"
      : "TeamShots Verification Code";

    const text = locale === 'es'
      ? `Tu código de verificación es: ${code}\n\nEste código expira en 5 minutos.`
      : `Your verification code is: ${code}\n\nThis code expires in 5 minutes.`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      text,
    });

    if (error) {
      console.error('Error sending OTP email:', error);
      return { success: false, error };
    }

    console.log('OTP email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error };
  }
}

interface SendMagicLinkEmailParams {
  email: string;
  magicLink: string;
  locale?: 'en' | 'es';
}

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail({
  email,
  magicLink,
  locale = 'en',
}: SendMagicLinkEmailParams) {
  try {
    const subject = locale === 'es' 
      ? "Enlace mágico TeamShots"
      : "TeamShots Magic Link";

    const text = locale === 'es'
      ? `Haz clic en el siguiente enlace para iniciar sesión:\n\n${magicLink}\n\nEste enlace expira en 24 horas.`
      : `Click the following link to sign in:\n\n${magicLink}\n\nThis link expires in 24 hours.`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      text,
    });

    if (error) {
      console.error('Error sending magic link email:', error);
      return { success: false, error };
    }

    console.log('Magic link email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send magic link email:', error);
    return { success: false, error };
  }
}

interface SendTeamInviteEmailParams {
  email: string;
  companyName: string;
  inviteLink: string;
  creditsAllocated: number;
  locale?: 'en' | 'es';
}

/**
 * Send team invitation email
 */
export async function sendTeamInviteEmail({
  email,
  companyName,
  inviteLink,
  creditsAllocated,
  locale = 'en',
}: SendTeamInviteEmailParams) {
  try {
    const subject = getEmailTranslation('teamInvite.subject', locale, { companyName });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      react: TeamInviteEmail({ 
        companyName, 
        inviteLink, 
        creditsAllocated, 
        locale 
      }),
    });

    if (error) {
      console.error('Error sending team invite email:', error);
      return { success: false, error };
    }

    console.log('Team invite email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send team invite email:', error);
    return { success: false, error };
  }
}

