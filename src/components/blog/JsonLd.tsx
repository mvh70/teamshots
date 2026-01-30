import Script from 'next/script';

interface ArticleJsonLdProps {
  headline: string;
  description: string;
  authorName: string;
  authorUrl?: string;
  authorJobTitle?: string;
  publisherName?: string;
  publisherUrl?: string;
  datePublished: string;
  dateModified?: string;
  url: string;
  image?: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqJsonLdProps {
  items: FaqItem[];
}

export function ArticleJsonLd({
  headline,
  description,
  authorName,
  authorUrl,
  authorJobTitle,
  publisherName = 'TeamShotsPro',
  publisherUrl = 'https://teamshotspro.com',
  datePublished,
  dateModified,
  url,
  image,
}: ArticleJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    ...(image && { image }),
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorUrl && { url: authorUrl }),
      ...(authorJobTitle && { jobTitle: authorJobTitle }),
    },
    publisher: {
      '@type': 'Organization',
      name: publisherName,
      url: publisherUrl,
    },
    datePublished,
    dateModified: dateModified || datePublished,
    mainEntityOfPage: url,
  };

  return (
    <Script
      id="article-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: Array<{ label: string; href?: string }>;
  baseUrl: string;
}

export function BreadcrumbJsonLd({ items, baseUrl }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href && { item: `${baseUrl}${item.href}` }),
    })),
  };

  return (
    <Script
      id="breadcrumb-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FaqJsonLd({ items }: FaqJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

