import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { BRAND_CONFIG } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';

interface MagicLinkEmailProps {
  magicLink: string;
  locale?: 'en' | 'es';
}

export default function MagicLinkEmail({
  magicLink,
  locale = 'en'
}: MagicLinkEmailProps) {
  const subject = getEmailTranslation('magicLink.subject', locale);
  const preview = getEmailTranslation('magicLink.preview', locale);

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>{BRAND_CONFIG.name}</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h2}>
              {getEmailTranslation('magicLink.title', locale)}
            </Heading>
            
            <Text style={text}>
              {getEmailTranslation('magicLink.greeting', locale)}
            </Text>

            <Text style={text}>
              {getEmailTranslation('magicLink.instructions', locale)}
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={magicLink}>
                {getEmailTranslation('magicLink.button', locale)}
              </Button>
            </Section>

            <Text style={text}>
              {getEmailTranslation('magicLink.expires', locale)}
            </Text>

            <Text style={linkText}>
              {getEmailTranslation('magicLink.linkFallback', locale)}
            </Text>
            <Link href={magicLink} style={link}>
              {magicLink}
            </Link>

            <Section style={footer}>
              <Text style={footerText}>
                {getEmailTranslation('magicLink.footer', locale)}
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  padding: '32px 24px',
  backgroundColor: BRAND_CONFIG.colors.primary,
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0',
};

const content = {
  padding: '0 48px',
};

const h2 = {
  color: '#333333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: BRAND_CONFIG.colors.cta,
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const linkText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0 8px',
};

const link = {
  color: BRAND_CONFIG.colors.primary,
  fontSize: '14px',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
};

const footer = {
  marginTop: '32px',
  paddingTop: '32px',
  borderTop: '1px solid #e6ebf1',
};

const footerText = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
};

