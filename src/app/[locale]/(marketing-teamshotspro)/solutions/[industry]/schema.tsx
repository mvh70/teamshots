import type { BrandConfig } from '@/config/brand';
import type { SolutionConfig } from '@/config/solutions';
import { organizationSchema, inLanguageForLocale } from '@/lib/schema';

interface SolutionSchemaProps {
  baseUrl: string;
  brand: BrandConfig;
  locale: string;
  solution: SolutionConfig;
  seo: {
    title: string;
    description: string;
  };
  faqItems: Array<{ question: string; answer: string }>;
  howItWorksSteps: Array<{
    number: string;
    title: string;
    description: string;
  }>;
  comparisonRows: string[][];
}

export function SolutionSchema({
  baseUrl,
  brand,
  locale,
  solution,
  seo,
  faqItems,
  howItWorksSteps,
  comparisonRows,
}: SolutionSchemaProps) {
  const brandName = brand.name;
  const pageUrl = locale === 'en'
    ? `${baseUrl}/solutions/${solution.slug}`
    : `${baseUrl}/${locale}/solutions/${solution.slug}`;

  // WebPage schema - describes this specific page
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: seo.title,
    description: seo.description,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${baseUrl}#website`,
      url: baseUrl,
      name: brandName,
      publisher: {
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
      },
    },
    about: {
      '@type': 'Thing',
      name: `AI headshots for ${solution.label.toLowerCase()}`,
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${baseUrl}${solution.heroImage}`,
    },
    inLanguage: inLanguageForLocale(locale),
    potentialAction: {
      '@type': 'ReadAction',
      target: pageUrl,
    },
  };

  // Service schema - describes the service offering for this industry
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: `${brandName} for ${solution.label}`,
    description: seo.description,
    provider: {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: brandName,
    },
    serviceType: 'AI Professional Headshot Photography',
    areaServed: {
      '@type': 'Place',
      name: 'Worldwide',
    },
    audience: {
      '@type': 'Audience',
      audienceType: solution.label,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${solution.label} Headshot Packages`,
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Team Headshots',
            description: '10 professional photos per team member with volume discounts',
          },
          priceSpecification: {
            '@type': 'PriceSpecification',
            priceCurrency: 'USD',
            price: '10.49',
            minPrice: '10.49',
            maxPrice: '29.99',
            eligibleQuantity: {
              '@type': 'QuantitativeValue',
              minValue: 2,
              unitText: 'team members',
            },
          },
        },
      ],
    },
    termsOfService: `${baseUrl}/legal/terms`,
  };

  // Organization schema
  const orgSchema = {
    '@context': 'https://schema.org',
    ...organizationSchema(brand, baseUrl),
    description: `${brandName} provides AI-powered professional headshots for ${solution.label.toLowerCase()} teams.`,
  };

  // BreadcrumbList schema - navigation path
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
        name: 'Solutions',
        item: `${baseUrl}/solutions`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: solution.label,
        item: pageUrl,
      },
    ],
  };

  // FAQPage schema - critical for rich results
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

  // HowTo schema - for the process section
  const howToSchema = howItWorksSteps.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: `How to Get Professional Headshots for ${solution.label}`,
        description: `Get consistent, on-brand professional headshots for your entire ${solution.label.toLowerCase()} team in ${howItWorksSteps.length} simple steps.`,
        totalTime: 'PT2M',
        estimatedCost: {
          '@type': 'MonetaryAmount',
          currency: 'USD',
          value: '10.49',
          description: 'Starting price per team member',
        },
        step: howItWorksSteps.map((step, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          name: step.title,
          text: step.description,
        })),
      }
    : null;

  // Comparison table as ItemList
  const comparisonSchema = comparisonRows.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${pageUrl}#comparison`,
        name: `${solution.label} Headshot Options Compared`,
        description: `Comparison of traditional photography vs ${brandName} for ${solution.label.toLowerCase()} teams`,
        itemListElement: comparisonRows.map((row, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: row[0],
          description: `Traditional: ${row[1]} | ${brandName}: ${row[2]}`,
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      {howToSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />
      )}
      {comparisonSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(comparisonSchema) }}
        />
      )}
    </>
  );
}
