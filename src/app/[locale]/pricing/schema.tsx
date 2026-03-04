import type { BrandConfig } from '@/config/brand';
import type { LandingVariant } from '@/config/landing-content';
import { organizationSchema, inLanguageForLocale } from '@/lib/schema';

const PRICE_VALID_UNTIL = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

interface PricingSchemaProps {
  baseUrl: string;
  brand: BrandConfig;
  locale: string;
  variant: LandingVariant | undefined;
  // Individual pricing (for non-team variants, including Portreya)
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
  brand,
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
  const brandName = brand.name;
  const isTeamVariant = variant === 'teamshotspro';
  const isRightClickFitVariant = variant === 'rightclickfit';
  const pageUrl = locale === 'en'
    ? `${baseUrl}/pricing`
    : `${baseUrl}/${locale}/pricing`;

  // WebPage schema
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: isRightClickFitVariant
      ? `${brandName} Pricing - Virtual Try-On Credits`
      : `${brandName} Pricing - Professional AI Headshots`,
    description: isTeamVariant
      ? 'Team headshot pricing with volume discounts. Pay per team member, get 10 professional photos each. No subscriptions.'
      : isRightClickFitVariant
        ? 'Simple credit packs for instant virtual try-ons. Start free and pay only when you need more outfit previews.'
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
      name: isRightClickFitVariant ? 'Virtual try-on pricing' : 'AI headshot photography pricing',
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

  // Product schema for the main offering
  const productSchema = isTeamVariant
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
        image: `${baseUrl}${brand.ogImage}`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: seatsMinPrice?.toFixed(2) || '10.49',
          highPrice: seatsMaxPrice?.toFixed(2) || '29.99',
          offerCount: '6',
          priceValidUntil: PRICE_VALID_UNTIL,
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
    : isRightClickFitVariant
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': `${baseUrl}#product`,
          name: `${brandName} Virtual Try-On Credits`,
          description: 'Credit packs for instant virtual try-ons via the RightClickFit browser extension.',
          brand: {
            '@type': 'Brand',
            name: brandName,
          },
          category: 'Shopping Software',
          image: `${baseUrl}${brand.ogImage}`,
          offers: [
            individualPrice && {
              '@type': 'Offer',
              name: 'Starter Credits',
              priceCurrency: 'USD',
              price: individualPrice.toFixed(2),
              priceValidUntil: PRICE_VALID_UNTIL,
              availability: 'https://schema.org/InStock',
              description: `${individualPhotos} virtual try-on credits`,
              seller: {
                '@type': 'Organization',
                name: brandName,
              },
            },
            vipPrice && {
              '@type': 'Offer',
              name: 'Pro Credits',
              priceCurrency: 'USD',
              price: vipPrice.toFixed(2),
              priceValidUntil: PRICE_VALID_UNTIL,
              availability: 'https://schema.org/InStock',
              description: `${vipPhotos} virtual try-on credits for heavy use`,
              seller: {
                '@type': 'Organization',
                name: brandName,
              },
            },
            {
              '@type': 'Offer',
              name: 'Free Install',
              priceCurrency: 'USD',
              price: '0',
              priceValidUntil: PRICE_VALID_UNTIL,
              availability: 'https://schema.org/InStock',
              description: 'Install the extension and start free',
              seller: {
                '@type': 'Organization',
                name: brandName,
              },
            },
          ].filter(Boolean),
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
        image: `${baseUrl}${brand.ogImage}`,
        offers: [
          individualPrice && {
            '@type': 'Offer',
            name: 'Personal Plan',
            priceCurrency: 'USD',
            price: individualPrice.toFixed(2),
            priceValidUntil: PRICE_VALID_UNTIL,
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
            priceValidUntil: PRICE_VALID_UNTIL,
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
            priceValidUntil: PRICE_VALID_UNTIL,
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
    name: isRightClickFitVariant
      ? `${brandName} Virtual Try-On Service`
      : `${brandName} Professional Headshot Service`,
    description: isRightClickFitVariant
      ? 'Browser-based virtual try-on service that lets users preview outfits instantly.'
      : 'AI-powered professional headshot generation service. Transform selfies into studio-quality professional photos in 60 seconds.',
    provider: {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: brandName,
    },
    serviceType: isRightClickFitVariant ? 'Virtual Try-On Software' : 'AI Photo Generation',
    areaServed: 'Worldwide',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: isRightClickFitVariant ? 'Virtual Try-On Credit Packs' : 'Headshot Packages',
      itemListElement: isTeamVariant
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
        : isRightClickFitVariant
          ? [
              {
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  name: 'Starter Credits',
                  description: 'Credit pack for everyday virtual outfit try-ons',
                },
              },
              {
                '@type': 'Offer',
                itemOffered: {
                  '@type': 'Service',
                  name: 'Pro Credits',
                  description: 'Larger credit pack for frequent shopping and repeated previews',
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
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
    </>
  );
}
