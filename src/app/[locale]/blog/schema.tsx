import Script from 'next/script';

import type { BlogPost } from '@/config/blog';
import type { LandingVariant } from '@/config/landing-content';

interface BlogIndexSchemaProps {
  baseUrl: string;
  brandName: string;
  locale: string;
  variant: LandingVariant | undefined;
  title: string;
  description: string;
  posts: BlogPost[];
}

export function BlogIndexSchema({
  baseUrl,
  brandName,
  locale,
  variant,
  title,
  description,
  posts,
}: BlogIndexSchemaProps) {
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
    inLanguage: locale === 'es' ? 'es-ES' : 'en-US',
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
      ? `${brandName} provides AI-powered professional headshots for teams. Get consistent, on-brand corporate photos from selfies in 60 seconds.`
      : `${brandName} provides AI-powered professional headshots. Transform selfies into studio-quality photos instantly.`,
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
    inLanguage: ['en-US', 'es-ES'],
  };

  return (
    <>
      <Script
        id="blog-webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Script
        id="blog-collection-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      <Script
        id="blog-organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="blog-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="blog-website-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}
