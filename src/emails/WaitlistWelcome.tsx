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

interface WaitlistWelcomeEmailProps {
  email: string;
  locale?: 'en' | 'es';
}

const translations = {
  en: {
    preview: "Welcome to TeamShots - You're on the list!",
    heading: "You're on the Waitlist! 🎉",
    intro: "Thanks for joining TeamShots early access. We're excited to have you on board!",
    whatNext: "What happens next?",
    step1: {
      title: "We're Finalizing the Product",
      description: "Our team is working hard to deliver an amazing experience. We're in the final stages of development."
    },
    step2: {
      title: "You'll Get Early Access",
      description: "As a waitlist member, you'll be among the first to try TeamShots when we launch."
    },
    step3: {
      title: "Special Launch Offer",
      description: "We'll send you an exclusive discount code when we go live. You'll save big on your first professional team photos."
    },
    valueProps: {
      title: "Here's what you can expect:",
      point1: "Professional headshots in 60 seconds",
      point2: "Save $2,000+ vs traditional photography",
      point3: "Perfect for remote and distributed teams",
      point4: "AI-powered by Google Gemini"
    },
    questions: "Have questions? Just reply to this email - we'd love to hear from you!",
    thanks: "Thanks for your support,",
    team: "The TeamShots Team",
    footer: "You're receiving this because you signed up for the TeamShots waitlist.",
    unsubscribe: "Don't want these emails?",
    unsubscribeLink: "Unsubscribe"
  },
  es: {
    preview: "¡Bienvenido a TeamShots - Estás en la lista!",
    heading: "¡Estás en la Lista de Espera! 🎉",
    intro: "Gracias por unirte al acceso anticipado de TeamShots. ¡Estamos emocionados de tenerte con nosotros!",
    whatNext: "¿Qué sigue?",
    step1: {
      title: "Estamos Finalizando el Producto",
      description: "Nuestro equipo está trabajando arduamente para ofrecer una experiencia increíble. Estamos en las etapas finales de desarrollo."
    },
    step2: {
      title: "Obtendrás Acceso Anticipado",
      description: "Como miembro de la lista de espera, serás de los primeros en probar TeamShots cuando lancemos."
    },
    step3: {
      title: "Oferta Especial de Lanzamiento",
      description: "Te enviaremos un código de descuento exclusivo cuando estemos en vivo. Ahorrarás mucho en tus primeras fotos profesionales de equipo."
    },
    valueProps: {
      title: "Esto es lo que puedes esperar:",
      point1: "Fotos profesionales en 60 segundos",
      point2: "Ahorra más de $2,000 vs fotografía tradicional",
      point3: "Perfecto para equipos remotos y distribuidos",
      point4: "Impulsado por IA de Google Gemini"
    },
    questions: "¿Tienes preguntas? Simplemente responde a este correo - ¡nos encantaría escucharte!",
    thanks: "Gracias por tu apoyo,",
    team: "El Equipo de TeamShots",
    footer: "Estás recibiendo esto porque te inscribiste en la lista de espera de TeamShots.",
    unsubscribe: "¿No quieres estos correos?",
    unsubscribeLink: "Cancelar suscripción"
  }
};

export default function WaitlistWelcomeEmail({
  email,
  locale = 'en',
}: WaitlistWelcomeEmailProps) {
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.teamshots.vip';

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src={`${baseUrl}/branding/logo-dark.svg`}
              width="180"
              height="40"
              alt="TeamShots"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{t.heading}</Heading>
            
            <Text style={text}>
              {t.intro}
            </Text>

            <Heading as="h2" style={h2}>
              {t.whatNext}
            </Heading>

            {/* Step 1 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>1</Text>
              <div>
                <Text style={stepTitle}>{t.step1.title}</Text>
                <Text style={stepDescription}>{t.step1.description}</Text>
              </div>
            </Section>

            {/* Step 2 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>2</Text>
              <div>
                <Text style={stepTitle}>{t.step2.title}</Text>
                <Text style={stepDescription}>{t.step2.description}</Text>
              </div>
            </Section>

            {/* Step 3 */}
            <Section style={stepSection}>
              <Text style={stepNumber}>3</Text>
              <div>
                <Text style={stepTitle}>{t.step3.title}</Text>
                <Text style={stepDescription}>{t.step3.description}</Text>
              </div>
            </Section>

            {/* Value Props Box */}
            <Section style={valuePropsBox}>
              <Heading as="h3" style={valuePropsTitle}>
                {t.valueProps.title}
              </Heading>
              <ul style={valueList}>
                <li style={valueItem}>✅ {t.valueProps.point1}</li>
                <li style={valueItem}>✅ {t.valueProps.point2}</li>
                <li style={valueItem}>✅ {t.valueProps.point3}</li>
                <li style={valueItem}>✅ {t.valueProps.point4}</li>
              </ul>
            </Section>

            <Text style={text}>
              {t.questions}
            </Text>

            <Text style={signature}>
              {t.thanks}<br />
              <strong>{t.team}</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              {t.footer}
            </Text>
            <Text style={footerText}>
              {t.unsubscribe}{' '}
              <Link href={`${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`} style={footerLink}>
                {t.unsubscribeLink}
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
  backgroundColor: '#f97316',
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
  border: '2px solid #f97316',
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

