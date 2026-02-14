import type { LandingVariant } from '@/config/landing-content';

interface LandingSchemaProps {
  baseUrl: string;
  brandName: string;
  locale: string;
  variant: LandingVariant;
  faqItems: Array<{ question: string; answer: string }>;
}

export function LandingSchema({
  baseUrl,
  brandName,
  locale,
  variant,
  faqItems,
}: LandingSchemaProps) {
  const pageUrl = locale === 'en' ? baseUrl : `${baseUrl}/${locale}`;

  // WebSite schema - critical for search features
  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}#website`,
    url: baseUrl,
    name: brandName,
    description: variant === 'teamshotspro'
      ? 'AI-powered professional team headshots. Transform any selfie into consistent, on-brand corporate photos in 60 seconds.'
      : 'AI-powered professional headshots. Transform any selfie into studio-quality photos in 60 seconds.',
    publisher: {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: brandName,
    },
    inLanguage: ['en-US', 'es-ES'],
  };

  // WebPage schema
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: variant === 'teamshotspro'
      ? `Professional Team Photos in 60 Seconds | ${brandName}`
      : `Professional AI Headshots | ${brandName}`,
    description: variant === 'teamshotspro'
      ? 'Turn any selfie into consistent, on-brand headshots. No photographer, no coordination. Professional AI headshots for your entire team.'
      : 'Transform any selfie into a professional headshot in 60 seconds. No photographer needed.',
    isPartOf: {
      '@id': `${baseUrl}#website`,
    },
    about: {
      '@type': 'Thing',
      name: 'AI professional headshot photography',
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${baseUrl}/branding/og-image.jpg`,
    },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', 'h2', '.text-xl'],
    },
    inLanguage: locale === 'es' ? 'es-ES' : 'en-US',
  };

  // Organization schema with detailed info
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}#organization`,
    name: brandName,
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/branding/teamshotspro_trans.webp`,
      width: 300,
      height: 60,
    },
    image: `${baseUrl}/branding/og-image.jpg`,
    description: variant === 'teamshotspro'
      ? 'TeamShotsPro provides AI-powered professional headshots for teams. Get consistent, on-brand corporate photos from selfies in 60 seconds.'
      : 'Professional AI headshot service. Transform selfies into studio-quality photos instantly.',
    foundingDate: '2025',
    sameAs: [
      'https://www.linkedin.com/company/teamshotspro',
      'https://twitter.com/teamshotspro',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@teamshotspro.com',
      contactType: 'customer support',
      availableLanguage: ['English', 'Spanish', 'French', 'German', 'Dutch'],
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
  };

  // SoftwareApplication schema - positions product as a web app
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${baseUrl}#software`,
    name: brandName,
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free trial with 3 sample photos',
      availability: 'https://schema.org/InStock',
    },
    featureList: variant === 'teamshotspro'
      ? [
          'AI-powered professional headshots',
          'Team management dashboard',
          'Brand consistency controls',
          '60-second generation time',
          'Bulk team photo processing',
          '30-day money-back guarantee',
        ]
      : [
          'AI-powered professional headshots',
          '60-second generation time',
          'Multiple style options',
          'No subscription required',
        ],
  };

  // Service schema
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${baseUrl}#service`,
    name: `${brandName} Professional Headshot Service`,
    description: variant === 'teamshotspro'
      ? 'AI-powered professional headshot generation for teams. Transform selfies into consistent, on-brand corporate photos in 60 seconds.'
      : 'AI-powered professional headshot generation. Transform any selfie into studio-quality professional photos in 60 seconds.',
    provider: {
      '@id': `${baseUrl}#organization`,
    },
    serviceType: 'AI Photo Generation',
    areaServed: {
      '@type': 'Place',
      name: 'Worldwide',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Headshot Packages',
      itemListElement: variant === 'teamshotspro'
        ? [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Free Trial',
                description: '3 sample headshots with watermark to test quality',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Team Headshots',
                description: '10 professional photos per team member with volume discounts',
              },
            },
          ]
        : [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Free Trial',
                description: '3 sample headshots to test quality',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Personal Headshots',
                description: 'Professional AI headshots for individuals',
              },
            },
          ],
    },
    termsOfService: `${baseUrl}/legal/terms`,
    providerMobility: 'static',
  };

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: pageUrl,
      },
    ],
  };

  // FAQPage schema
  const faqSchema = faqItems.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null;

  // HowTo schema for the process section
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: variant === 'teamshotspro'
      ? 'How to Get Professional Team Headshots'
      : 'How to Get a Professional AI Headshot',
    description: variant === 'teamshotspro'
      ? 'Get consistent, on-brand professional headshots for your entire team in 4 simple steps.'
      : 'Transform any selfie into a professional headshot in 60 seconds.',
    totalTime: 'PT2M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
      description: 'Free trial available',
    },
    step: variant === 'teamshotspro'
      ? [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Set Your Brand Identity',
            text: 'Define backgrounds, logo placement, and clothing style. Control what stays fixed and what team members can customize.',
            image: `${baseUrl}/images/how-it-works/step-1-v2.png`,
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Invite Your Team',
            text: 'Send invitations to team members. They can generate photos without creating an account.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Team Members Upload Selfies',
            text: 'Each team member uploads a selfie from their phone or computer.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Get Your Assets',
            text: 'Professional headshots are generated in 60 seconds. Review and download from your admin panel.',
          },
        ]
      : [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Upload Your Selfie',
            text: 'Upload any clear photo of your face. Selfies from your phone work great.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Customize Your Style',
            text: 'Choose your background, clothing style, and lighting preferences.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Generate Your Headshot',
            text: 'AI generates your professional headshot in 60 seconds.',
          },
        ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  );
}
