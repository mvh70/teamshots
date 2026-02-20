import type { BrandConfig } from '@/config/brand';
import { organizationSchema, inLanguageForLocale } from '@/lib/schema';

interface CostCalculatorSchemaProps {
  baseUrl: string;
  brand: BrandConfig;
  locale: string;
  t: (key: string) => string;
}

export function CostCalculatorSchema({ baseUrl, brand, locale, t }: CostCalculatorSchemaProps) {
  const brandName = brand.name;
  const pageUrl = locale === 'en'
    ? `${baseUrl}/headshot-cost-calculator`
    : `${baseUrl}/${locale}/headshot-cost-calculator`;

  // WebPage schema - ties everything together
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: t('meta.title'),
    description: t('meta.description'),
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${baseUrl}#website`,
      url: baseUrl,
      name: brandName,
      publisher: {
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
        name: brandName,
      },
    },
    about: {
      '@type': 'Thing',
      name: 'Corporate headshot photography cost comparison',
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${baseUrl}${brand.ogImage}`,
    },
    inLanguage: inLanguageForLocale(locale),
    potentialAction: {
      '@type': 'ReadAction',
      target: pageUrl,
    },
  };

  // WebApplication schema for the calculator tool
  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${brandName} Headshot Cost Calculator`,
    description:
      'Interactive calculator to compare the cost of AI-generated headshots vs traditional photography for teams.',
    url: pageUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use cost comparison calculator',
    },
    featureList: [
      'Compare AI vs traditional photography costs',
      'Adjustable team size from 2-200 people',
      'Customizable cost assumptions',
      'Real-time savings calculation',
      'Before/after comparison previews',
    ],
    provider: {
      '@type': 'Organization',
      name: brandName,
      url: baseUrl,
    },
  };

  // SoftwareApplication schema for the main product (no fake aggregateRating)
  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: brandName,
    description:
      'AI-powered professional headshot generator for teams. Upload a selfie and get studio-quality corporate headshots in 60 seconds.',
    url: baseUrl,
    applicationCategory: 'PhotographyApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '29',
      highPrice: '999',
      priceCurrency: 'USD',
      offerCount: '5',
    },
  };

  // Organization schema
  const orgSchema = {
    '@context': 'https://schema.org',
    ...organizationSchema(brand, baseUrl),
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
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Headshot Cost Calculator',
        item: pageUrl,
      },
    ],
  };

  // FAQPage schema with relevant questions (localized)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: t('faq.q1.question'),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t('faq.q1.answer'),
        },
      },
      {
        '@type': 'Question',
        name: t('faq.q2.question'),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t('faq.q2.answer'),
        },
      },
      {
        '@type': 'Question',
        name: t('faq.q3.question'),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t('faq.q3.answer'),
        },
      },
      {
        '@type': 'Question',
        name: t('faq.q4.question'),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t('faq.q4.answer'),
        },
      },
      {
        '@type': 'Question',
        name: t('faq.q5.question'),
        acceptedAnswer: {
          '@type': 'Answer',
          text: t('faq.q5.answer'),
        },
      },
    ],
  };

  // HowTo schema for using the calculator
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Calculate Your Team Headshot Costs',
    description:
      'Use this interactive calculator to compare AI headshot costs with traditional photography for your team.',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Select your team size',
        text: 'Use the slider to select the number of people who need headshots (2-200 people).',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Review the cost comparison',
        text: 'See the instant comparison between AI headshot costs and traditional photography costs.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Customize assumptions (optional)',
        text: 'Click "Customize assumptions" to adjust photographer rates, employee hourly costs, and other variables to match your situation.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'View your potential savings',
        text: 'Check the purple savings card to see your total potential savings in dollars and percentage.',
      },
    ],
    totalTime: 'PT1M',
    tool: {
      '@type': 'HowToTool',
      name: `${brandName} Cost Calculator`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
    </>
  );
}
