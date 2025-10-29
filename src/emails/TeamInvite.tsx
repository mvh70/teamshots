import React from 'react';
import { BRAND_CONFIG } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';
import { PRICING_CONFIG } from '@/config/pricing';
import { calculatePhotosFromCredits } from '@/domain/pricing';

interface TeamInviteEmailProps {
  companyName: string;
  inviteLink: string;
  creditsAllocated: number;
  locale?: 'en' | 'es';
}

export default function TeamInviteEmail({
  companyName,
  inviteLink,
  creditsAllocated,
  locale = 'en'
}: TeamInviteEmailProps) {
  // Calculate number of photos and variations from credits
  const numberOfPhotos = calculatePhotosFromCredits(creditsAllocated);
  const variations = PRICING_CONFIG.regenerations.business; // Use business regenerations for team invites

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: BRAND_CONFIG.colors.primary, color: 'white', padding: '20px', textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ margin: '0', fontSize: '24px' }}>
          {getEmailTranslation('teamInvite.title', locale)}
        </h1>
      </div>
      
      <div style={{ backgroundColor: 'white', padding: '30px', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px' }}>
        <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#374151', marginBottom: '20px' }}>
          {getEmailTranslation('teamInvite.greeting', locale, { companyName })}
        </p>

        <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '25px' }}>
          <h3 style={{ color: '#111827', marginTop: '0', marginBottom: '15px' }}>
            {getEmailTranslation('teamInvite.whatYouGet', locale)}
          </h3>
          <ul style={{ margin: '0', paddingLeft: '20px', color: '#374151' }}>
            <li style={{ marginBottom: '8px' }}>
              ✅ {getEmailTranslation('teamInvite.credits', locale, { 
                photos: numberOfPhotos.toString(), 
                variations: variations.toString() 
              })}
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ {getEmailTranslation('teamInvite.companyBranded', locale)}
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ {getEmailTranslation('teamInvite.noSignup', locale)}
            </li>
            <li style={{ marginBottom: '0' }}>
              ✅ {getEmailTranslation('teamInvite.directAccess', locale)}
            </li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <a
            href={inviteLink}
            style={{
              display: 'inline-block',
              backgroundColor: BRAND_CONFIG.colors.primary,
              color: 'white',
              padding: '12px 24px',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {getEmailTranslation('teamInvite.acceptButton', locale)}
          </a>
        </div>

        <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', marginBottom: '0' }}>
          {getEmailTranslation('teamInvite.expires', locale)}
        </p>
        
        <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', wordBreak: 'break-all', marginTop: '10px' }}>
          {inviteLink}
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '25px 0' }} />

        <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', marginBottom: '0' }}>
          {getEmailTranslation('teamInvite.questions', locale)}
        </p>
      </div>
    </div>
  );
}
