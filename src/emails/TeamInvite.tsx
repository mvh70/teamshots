import React from 'react';
import { BRAND_CONFIG } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';
import { calculatePhotosFromCredits } from '@/domain/pricing';

interface TeamInviteEmailProps {
  teamName: string;
  inviteLink: string;
  creditsAllocated: number;
  firstName?: string;
  inviterFirstName?: string;
  locale?: 'en' | 'es';
}

export default function TeamInviteEmail({
  teamName,
  inviteLink,
  creditsAllocated,
  firstName,
  inviterFirstName,
  locale = 'en'
}: TeamInviteEmailProps) {
  // Calculate number of photos and variations from credits
  const numberOfPhotos = calculatePhotosFromCredits(creditsAllocated);
  // Invited users get 4 regenerations
  const regenerations = 4;
  const totalPhotos = numberOfPhotos * (regenerations + 1);
  
  // Use personalized greeting if firstName is available
  const greetingKey = firstName ? 'teamInvite.greetingWithName' : 'teamInvite.greeting';
  const greetingParams: Record<string, string> = firstName 
    ? { firstName, teamName, inviterFirstName: inviterFirstName || 'your colleague' } 
    : { teamName };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', padding: '20px' }}>
      <div style={{ padding: '30px' }}>
        <p style={{ lineHeight: '1.6', marginBottom: '20px' }}>
          {getEmailTranslation(greetingKey, locale, greetingParams)}
        </p>

        <p style={{ lineHeight: '1.6', marginBottom: '20px', whiteSpace: 'pre-line' }}>
          {getEmailTranslation('teamInvite.photosDescription', locale, {
            credits: creditsAllocated.toString(),
            photos: numberOfPhotos.toString(),
            totalPhotos: totalPhotos.toString()
          })}
        </p>

        <p style={{ lineHeight: '1.6', marginBottom: '20px' }}>
          {getEmailTranslation('teamInvite.mobileAdvice', locale)}
        </p>

        <div style={{ marginBottom: '25px' }}>
          <a
            href={inviteLink}
            style={{
              display: 'inline-block',
              backgroundColor: BRAND_CONFIG.colors.primary,
              color: 'white',
              padding: '12px 24px',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '16px'
            }}
          >
            {getEmailTranslation('teamInvite.acceptButton', locale)}
          </a>
        </div>

        <p style={{ fontSize: '13px', fontFamily: 'Arial, sans-serif', marginBottom: '10px' }}>
          {getEmailTranslation('teamInvite.expires', locale)}
        </p>

        <p style={{ fontSize: '13px', fontFamily: 'Arial, sans-serif', wordBreak: 'break-all', marginBottom: '20px' }}>
          {inviteLink}
        </p>

        <p style={{ fontSize: '13px', fontFamily: 'Arial, sans-serif', marginTop: '30px' }}>
          {getEmailTranslation('teamInvite.questions', locale)}
        </p>
      </div>
    </div>
  );
}
