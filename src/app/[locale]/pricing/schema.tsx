import Script from 'next/script';

import type { LandingVariant } from '@/config/landing-content';

interface PricingSchemaProps {
  baseUrl: string;
  brandName: string;
  locale: string;
  variant: LandingVariant | undefined;
  // Individual pricing (for individualshots variant)
  individualPrice?: number;
  individualPhotos?: number;
  vipPrice?: number;
  vipPhotos?: number;
  // Seats pricing (for teamshotspro variant)
  seatsMinPrice?: number;
  seatsMaxPrice?: number;
  photosPerSeat?: number;
  // FAQ items
  faqItems: Array<{ question: string; answer: string }>;
}

export function PricingSchema({
  baseUrl,
  brandName,
  locale,
  variant,
  individualPrice,
  individualPhotos,
  vipPrice,
  vipPhotos,
  seatsMinPrice,
  seatsMaxPrice,
  photosPerSeat,
  faqItems,
}: PricingSchemaProps) {
  const pageUrl = locale === 'en'
    ? `${baseUrl}/pricing`
    : `${baseUrl}/${locale}/pricing`;

  // WebPage schema
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: `${brandName} Pricing - Professional AI Headshots`,
    description: variant === 'teamshotspro'
      ? 'Team headshot pricing with volume discounts. Pay per team member, get 10 professional photos each. No subscriptions.'
      : 'Simple, use-based pricing for AI headshots. No subscriptions or hidden fees. Pay only for the photos you generate.',
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
      name: 'AI headshot photography pricing',
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
    potentialAction: {
      '@type': 'ReadAction',
      target: pageUrl,
    },
  };

  // Product schema for the main offering
  const productSchema = variant === 'teamshotspro'
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${baseUrl}#product`,
        name: `${brandName} Team Headshots`,
        description: 'AI-powered professional headshots for teams. Upload a selfie, get studio-quality corporate headshots in 60 seconds.',
        brand: {
          '@type': 'Brand',
          name: brandName,
        },
        category: 'Photography Services',
        image: `${baseUrl}/branding/og-image.jpg`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: seatsMinPrice?.toFixed(2) || '10.49',
          highPrice: seatsMaxPrice?.toFixed(2) || '29.99',
          offerCount: '6',
          priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'Organization',
            name: brandName,
          },
          eligibleQuantity: {
            '@type': 'QuantitativeValue',
            minValue: 2,
            unitText: 'team members',
          },
        },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${baseUrl}#product`,
        name: `${brandName} AI Headshots`,
        description: 'AI-powered professional headshots. Upload a selfie, get studio-quality professional headshots in 60 seconds.',
        brand: {
          '@type': 'Brand',
          name: brandName,
        },
        category: 'Photography Services',
        image: `${baseUrl}/branding/og-image.jpg`,
        offers: [
          individualPrice && {
            '@type': 'Offer',
            name: 'Personal Plan',
            priceCurrency: 'USD',
            price: individualPrice.toFixed(2),
            priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: 'https://schema.org/InStock',
            description: `${individualPhotos} professional photos with full customization`,
            seller: {
              '@type': 'Organization',
              name: brandName,
            },
          },
          vipPrice && {
            '@type': 'Offer',
            name: 'VIP Plan',
            priceCurrency: 'USD',
            price: vipPrice.toFixed(2),
            priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: 'https://schema.org/InStock',
            description: `${vipPhotos} professional photos for power users`,
            seller: {
              '@type': 'Organization',
              name: brandName,
            },
          },
          {
            '@type': 'Offer',
            name: 'Free Trial',
            priceCurrency: 'USD',
            price: '0',
            priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: 'https://schema.org/InStock',
            description: 'Try before you buy - no credit card required',
            seller: {
              '@type': 'Organization',
              name: brandName,
            },
          },
        ].filter(Boolean),
      };

  // Service schema for SEO
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${baseUrl}#service`,
    name: `${brandName} Professional Headshot Service`,
    description: 'AI-powered professional headshot generation service. Transform selfies into studio-quality professional photos in 60 seconds.',
    provider: {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: brandName,
    },
    serviceType: 'AI Photo Generation',
    areaServed: 'Worldwide',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Headshot Packages',
      itemListElement: variant === 'teamshotspro'
        ? [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Team Headshots',
                description: `${photosPerSeat || 10} professional photos per team member with volume discounts`,
              },
            },
          ]
        : [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Personal Headshots',
                description: `${individualPhotos} professional photos with full customization`,
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'VIP Headshots',
                description: `${vipPhotos} professional photos for power users`,
              },
            },
          ],
    },
  };

  // Organization schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}#organization`,
    name: brandName,
    url: baseUrl,
    logo: `${baseUrl}/branding/teamshotspro_trans.webp`,
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
        name: 'Pricing',
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

  return (
    <>
      <Script
        id="pricing-webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Script
        id="pricing-product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Script
        id="pricing-service-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <Script
        id="pricing-organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="pricing-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <Script
          id="pricing-faq-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  );
}
