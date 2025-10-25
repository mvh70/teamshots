import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { BRAND_CONFIG } from '@/config/brand';
import { getEmailTranslation } from '@/lib/translations';

interface WaitlistWelcomeEmailProps {
  email: string;
  locale?: 'en' | 'es';
}

export default function WaitlistWelcomeEmail({
  email,
  locale = 'en',
}: WaitlistWelcomeEmailProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.teamshots.vip';

  return (
    <Html>
      <Head />
      <Preview>{getEmailTranslation('waitlistWelcome.title', locale)}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src={`${baseUrl}/branding/logo-dark.png`}
              width="180"
              height="40"
              alt="TeamShots"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{getEmailTranslation('waitlistWelcome.title', locale)}</Heading>
            
            <Text style={text}>
              {getEmailTranslation('waitlistWelcome.thankYou', locale)}
            </Text>

            <Heading as="h2" style={h2}>
              {getEmailTranslation('waitlistWelcome.whatToExpect', locale)}
            </Heading>

            {/* Step 1 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>1</Text>
              <div>
                <Text style={stepTitle}>{getEmailTranslation('waitlistWelcome.steps.step1.title', locale)}</Text>
                <Text style={stepDescription}>{getEmailTranslation('waitlistWelcome.steps.step1.description', locale)}</Text>
              </div>
            </Section>

            {/* Step 2 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>2</Text>
              <div>
                <Text style={stepTitle}>{getEmailTranslation('waitlistWelcome.steps.step2.title', locale)}</Text>
                <Text style={stepDescription}>{getEmailTranslation('waitlistWelcome.steps.step2.description', locale)}</Text>
              </div>
            </Section>

            {/* Step 3 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>3</Text>
              <div>
                <Text style={stepTitle}>{getEmailTranslation('waitlistWelcome.steps.step3.title', locale)}</Text>
                <Text style={stepDescription}>{getEmailTranslation('waitlistWelcome.steps.step3.description', locale)}</Text>
              </div>
            </Section>

            {/* Value Props Box */}
            <Section style={valuePropsBox}>
              <Heading as="h3" style={valuePropsTitle}>
                {getEmailTranslation('waitlistWelcome.valueProps.title', locale)}
              </Heading>
              <ul style={valueList}>
                <li style={valueItem}>✅ {getEmailTranslation('waitlistWelcome.valueProps.point1', locale)}</li>
                <li style={valueItem}>✅ {getEmailTranslation('waitlistWelcome.valueProps.point2', locale)}</li>
                <li style={valueItem}>✅ {getEmailTranslation('waitlistWelcome.valueProps.point3', locale)}</li>
                <li style={valueItem}>✅ {getEmailTranslation('waitlistWelcome.valueProps.point4', locale)}</li>
              </ul>
            </Section>

            <Text style={text}>
              {getEmailTranslation('waitlistWelcome.questions', locale)}
            </Text>

            <Text style={signature}>
              {getEmailTranslation('waitlistWelcome.bestRegards', locale)}<br />
              <strong>{getEmailTranslation('waitlistWelcome.team', locale)}</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              {getEmailTranslation('waitlistWelcome.footer', locale)}
            </Text>
            <Text style={footerText}>
              {getEmailTranslation('waitlistWelcome.unsubscribe', locale)}{' '}
              <Link href={`${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`} style={footerLink}>
                {getEmailTranslation('waitlistWelcome.unsubscribeLink', locale)}
              </Link>
            </Text>
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
  maxWidth: '600px',
};

const logoSection = {
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
};

const content = {
  padding: '0 40px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '16px 0',
  padding: '0',
  lineHeight: '1.3',
};

const h2 = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '32px 0 16px',
};

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
};

const stepSection = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '20px',
};

const stepNumber = {
  backgroundColor: BRAND_CONFIG.colors.primary,
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: '16px',
  flexShrink: 0,
  textAlign: 'center' as const,
  lineHeight: '32px',
};

const stepTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 4px',
};

const stepDescription = {
  color: '#525252',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const valuePropsBox = {
  backgroundColor: '#fef3f2',
  border: `2px solid ${BRAND_CONFIG.colors.primary}`,
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const valuePropsTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const valueList = {
  margin: '0',
  padding: '0',
  listStyle: 'none',
};

const valueItem = {
  color: '#525252',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '8px 0',
};

const signature = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '32px 0 16px',
};

const footer = {
  padding: '0 40px',
  marginTop: '32px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '8px 0',
  textAlign: 'center' as const,
};

const footerLink = {
  color: '#8898aa',
  textDecoration: 'underline',
};

