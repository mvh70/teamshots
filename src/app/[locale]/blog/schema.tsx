import type { BrandConfig } from '@/config/brand';
import type { BlogPost } from '@/config/blog';
import type { LandingVariant } from '@/config/landing-content';
import { organizationSchema, SUPPORTED_LANGUAGES, inLanguageForLocale } from '@/lib/schema';

interface BlogIndexSchemaProps {
  baseUrl: string;
  brand: BrandConfig;
  locale: string;
  variant: LandingVariant | undefined;
  title: string;
  description: string;
  posts: BlogPost[];
}

export function BlogIndexSchema({
  baseUrl,
  brand,
  locale,
  variant,
  title,
  description,
  posts,
}: BlogIndexSchemaProps) {
  const brandName = brand.name;
  const pageUrl = locale === 'en'
    ? `${baseUrl}/blog`
    : `${baseUrl}/${locale}/blog`;

  // WebPage schema with Blog type
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
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
      name: variant === 'teamshotspro'
        ? 'AI team headshots, professional photography, and corporate branding'
        : 'AI headshots and professional photography',
    },
    inLanguage: inLanguageForLocale(locale),
    potentialAction: {
      '@type': 'ReadAction',
      target: pageUrl,
    },
  };

  // CollectionPage schema for the blog listing
  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: title,
    description,
    isPartOf: {
      '@id': `${baseUrl}#website`,
    },
    about: {
      '@type': 'Thing',
      name: 'AI professional headshots and corporate photography guides',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.slice(0, 10).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: locale === 'en'
          ? `${baseUrl}/blog/${post.slug}`
          : `${baseUrl}/${locale}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  // Organization schema
  const orgSchema = {
    '@context': 'https://schema.org',
    ...organizationSchema(brand, baseUrl),
    description: variant === 'teamshotspro'
      ? `${brandName} provides AI-powered professional headshots for teams. Get consistent, on-brand corporate photos from selfies in 60 seconds.`
      : `${brandName} provides AI-powered professional headshots. Transform selfies into studio-quality photos instantly.`,
  };

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'es' ? 'Inicio' : 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: pageUrl,
      },
    ],
  };

  // WebSite schema with SearchAction
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
      '@id': `${baseUrl}#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: SUPPORTED_LANGUAGES,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}
