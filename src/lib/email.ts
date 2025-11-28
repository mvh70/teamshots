import { Buffer } from 'node:buffer';
import { Resend } from 'resend';
import WaitlistWelcomeEmail from '@/emails/WaitlistWelcome';
import TeamInviteEmail from '@/emails/TeamInvite';
import { BRAND_CONFIG, getBrandContact } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';
import { Env } from '@/lib/env';
import { Logger } from '@/lib/logger';

// Initialize Resend
const resend = new Resend(Env.string('RESEND_API_KEY'));

// Email configuration helpers - uses brand config for consistency
function getFromEmail(requestHeaders?: Headers): string {
  const contact = getBrandContact(requestHeaders);
  return `${BRAND_CONFIG.name} <${contact.hello}>`;
}

function getReplyToEmail(requestHeaders?: Headers): string {
  const contact = getBrandContact(requestHeaders);
  return contact.support;
}

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
      from: getFromEmail(),
      to: email,
      replyTo: getReplyToEmail(),
      subject,
      react: WaitlistWelcomeEmail({ locale }),
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
    const subject = getEmailTranslation('otp.subject', locale);
    const text = getEmailTranslation('otp.body', locale, { code });

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      replyTo: getReplyToEmail(),
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
    const subject = getEmailTranslation('magicLink.subject', locale);
    const text = getEmailTranslation('magicLink.body', locale, { link: magicLink });

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      replyTo: getReplyToEmail(),
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

interface SendWelcomeAfterPurchaseEmailParams {
  email: string;
  setupLink: string;
  photos: number;
  locale?: 'en' | 'es';
}

/**
 * Send welcome email after guest checkout with password setup link
 */
export async function sendWelcomeAfterPurchaseEmail({
  email,
  setupLink,
  photos,
  locale = 'en',
}: SendWelcomeAfterPurchaseEmailParams) {
  try {
    const subject = getEmailTranslation('welcomeAfterPurchase.subject', locale);
    const text = getEmailTranslation('welcomeAfterPurchase.body', locale, { 
      setupLink, 
      photos: String(photos) 
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; margin-bottom: 20px;">${getEmailTranslation('welcomeAfterPurchase.heading', locale)}</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          ${getEmailTranslation('welcomeAfterPurchase.intro', locale)}
        </p>
        
        <div style="background-color: #f0f9ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #0369a1; font-size: 18px; font-weight: bold; margin: 0;">
            ${getEmailTranslation('welcomeAfterPurchase.photosReceived', locale, { photos: String(photos) })}
          </p>
        </div>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          ${getEmailTranslation('welcomeAfterPurchase.setupInstructions', locale)}
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${setupLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            ${getEmailTranslation('welcomeAfterPurchase.ctaButton', locale)}
          </a>
        </div>
        
        <p style="color: #999; font-size: 14px; margin-top: 32px;">
          ${getEmailTranslation('welcomeAfterPurchase.linkExpiry', locale)}
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 16px;">
          ${getEmailTranslation('welcomeAfterPurchase.footer', locale)}
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      replyTo: getReplyToEmail(),
      subject,
      text,
      html,
    });

    if (error) {
      Logger.error('Error sending welcome after purchase email:', { error });
      return { success: false, error };
    }

    Logger.info('Welcome after purchase email sent successfully:', { id: data?.id });
    return { success: true, data };
  } catch (error) {
    Logger.error('Failed to send welcome after purchase email:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error };
  }
}

interface SendTeamInviteEmailParams {
  email: string;
  teamName: string;
  inviteLink: string;
  creditsAllocated: number;
  firstName?: string;
  inviterFirstName?: string;
  locale?: 'en' | 'es';
}

/**
 * Send team invitation email
 */
export async function sendTeamInviteEmail({
  email,
  teamName,
  inviteLink,
  creditsAllocated,
  firstName,
  inviterFirstName,
  locale = 'en',
}: SendTeamInviteEmailParams) {
  try {
    const subject = getEmailTranslation('teamInvite.subject', locale, { teamName });
    const text = getEmailTranslation('teamInvite.text', locale, { 
      teamName,
      inviteLink,
      creditsAllocated: String(creditsAllocated)
    });

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      replyTo: getReplyToEmail(),
      subject,
      text,
      react: TeamInviteEmail({ 
        teamName, 
        inviteLink, 
        creditsAllocated,
        firstName,
        inviterFirstName,
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

export interface SupportNotificationAttachment {
  filename: string;
  base64: string;
  mimeType?: string;
}

interface SendSupportNotificationEmailParams {
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
  attachments?: SupportNotificationAttachment[];
}

/**
 * Send notification email to support
 */
export async function sendSupportNotificationEmail({
  subject,
  message,
  metadata = {},
  attachments = [],
}: SendSupportNotificationEmailParams) {
  try {
    const metadataText = Object.keys(metadata).length > 0
      ? '\n\nMetadata:\n' + JSON.stringify(metadata, null, 2)
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Support Notification</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        ${metadataText ? `<pre style="background-color: #f9f9f9; padding: 10px; border-radius: 3px; font-size: 12px; overflow-x: auto;">${JSON.stringify(metadata, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>` : ''}
      </div>
    `;

    const replyTo = getReplyToEmail();
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: replyTo, // Send to support email
      replyTo: replyTo,
      subject: `[Support Notification] ${subject}`,
      html,
      text: `${message}${metadataText}`,
      attachments: attachments.map(({ filename, base64, mimeType }) => ({
        filename,
        content: Buffer.from(base64, 'base64'),
        contentType: mimeType ?? 'application/octet-stream',
      })),
    });

    if (error) {
      console.error('Error sending support notification email:', error);
      return { success: false, error };
    }

    console.log('Support notification email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send support notification email:', error);
    return { success: false, error };
  }
}

interface SendAdminSignupNotificationEmailParams {
  email: string;
  firstName: string;
  lastName?: string | null;
  userType: 'individual' | 'team';
  locale?: 'en' | 'es';
  teamId?: string | null;
  teamWebsite?: string | null;
}

interface SendOrderNotificationEmailParams {
  customerEmail: string;
  customerName: string;
  orderType: 'plan' | 'top_up';
  planTier?: string | null;
  planPeriod?: string | null;
  credits: number;
  amountPaid: number;
  currency: string;
  stripeSessionId: string;
  isNewUser: boolean;
}

/**
 * Send notification email to support when an order is placed
 */
export async function sendOrderNotificationEmail({
  customerEmail,
  customerName,
  orderType,
  planTier,
  planPeriod,
  credits,
  amountPaid,
  currency,
  stripeSessionId,
  isNewUser,
}: SendOrderNotificationEmailParams) {
  const contact = getBrandContact();
  const adminRecipient = contact.hello || contact.support;

  if (!adminRecipient) {
    Logger.warn('Order notification skipped - no admin recipient configured');
    return { success: false, error: 'ADMIN_EMAIL_NOT_CONFIGURED' };
  }

  const orderTypeLabel = orderType === 'plan' ? 'Plan Purchase' : 'Credit Top-up';
  const planLabel = planTier && planPeriod ? `${planTier} ${planPeriod}` : 'N/A';
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountPaid);

  const subject = `[${BRAND_CONFIG.name}] New ${orderTypeLabel} - ${formattedAmount}`;

  const textBody = [
    `New ${orderTypeLabel}`,
    '',
    `Customer: ${customerName || 'N/A'}`,
    `Email: ${customerEmail}`,
    `New user: ${isNewUser ? 'Yes' : 'No'}`,
    '',
    `Order Type: ${orderTypeLabel}`,
    `Plan: ${planLabel}`,
    `Credits: ${credits}`,
    `Amount: ${formattedAmount}`,
    '',
    `Stripe Session: ${stripeSessionId}`,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New ${orderTypeLabel} 🎉</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; font-weight: bold; width: 140px;">Customer</td>
            <td style="padding: 12px;">${customerName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">Email</td>
            <td style="padding: 12px;"><a href="mailto:${customerEmail}">${customerEmail}</a></td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; font-weight: bold;">New user</td>
            <td style="padding: 12px;">${isNewUser ? '<span style="color: #22c55e;">Yes</span>' : 'No'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">Order Type</td>
            <td style="padding: 12px;">${orderTypeLabel}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; font-weight: bold;">Plan</td>
            <td style="padding: 12px;">${planLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">Credits</td>
            <td style="padding: 12px;"><strong>${credits}</strong></td>
          </tr>
          <tr style="background-color: #e8f5e9;">
            <td style="padding: 12px; font-weight: bold;">Amount</td>
            <td style="padding: 12px;"><strong style="color: #22c55e;">${formattedAmount}</strong></td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top: 16px; font-size: 12px; color: #666;">
        Stripe Session: <code>${stripeSessionId}</code>
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: adminRecipient,
      replyTo: getReplyToEmail(),
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      Logger.error('Error sending order notification email', { error });
      return { success: false, error };
    }

    Logger.info('Order notification email sent', { id: data?.id });
    return { success: true, data };
  } catch (error) {
    Logger.error('Failed to send order notification email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error };
  }
}

export async function sendAdminSignupNotificationEmail({
  email,
  firstName,
  lastName,
  userType,
  locale = 'en',
  teamId,
  teamWebsite,
}: SendAdminSignupNotificationEmailParams) {
  const contact = getBrandContact();
  const adminRecipient = contact.hello || contact.support;

  if (!adminRecipient) {
    Logger.warn('Admin signup notification skipped - no admin recipient configured');
    return { success: false, error: 'ADMIN_EMAIL_NOT_CONFIGURED' };
  }

  const subject = `[${BRAND_CONFIG.name}] New ${userType} signup`;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const textBody = [
    `New ${userType} signup`,
    '',
    `Name: ${fullName || 'N/A'}`,
    `Email: ${email}`,
    `Locale: ${locale}`,
    `Team ID: ${teamId ?? 'N/A'}`,
    `Team website: ${teamWebsite ?? 'N/A'}`,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New ${userType} signup</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 140px;">Name</td>
            <td style="padding: 8px;">${fullName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Email</td>
            <td style="padding: 8px;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Locale</td>
            <td style="padding: 8px;">${locale}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Team ID</td>
            <td style="padding: 8px;">${teamId ?? 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Team website</td>
            <td style="padding: 8px;">${teamWebsite ?? 'N/A'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: adminRecipient,
      replyTo: getReplyToEmail(),
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      Logger.error('Error sending admin signup notification email', {
        error,
      });
      return { success: false, error };
    }

    Logger.info('Admin signup notification email sent', { id: data?.id });
    return { success: true, data };
  } catch (error) {
    Logger.error('Failed to send admin signup notification email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error };
  }
}

