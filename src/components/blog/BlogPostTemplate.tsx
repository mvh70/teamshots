import React from 'react';
import { Link } from '@/i18n/routing';
import { InlineCTA } from '@/components/blog/InlineCTA';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import { headers } from 'next/headers';
import { getBrand } from '@/config/brand';
import { getBaseUrl } from '@/lib/url';
import {
  ArticleJsonLd,
  FaqJsonLd,
  BreadcrumbJsonLd,
  AuthorBox,
  TldrSection,
  Breadcrumb,
  BlogHeroImage,
} from '@/components/blog';

/**
 * Render pre-generated schema from CMS
 */
function StoredSchemaJsonLd({ schemaJson }: { schemaJson: string }) {
  try {
    const schema = JSON.parse(schemaJson);

    // Support array or @graph formats by emitting a single JSON-LD block
    if (Array.isArray(schema) || schema['@graph']) {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
        />
      );
    }

    // Handle both wrapped format { article: {...}, faq: {...} } and direct format
    return (
      <>
        {schema.article && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({ '@context': 'https://schema.org', ...schema.article }),
            }}
          />
        )}
        {schema.faq && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({ '@context': 'https://schema.org', ...schema.faq }),
            }}
          />
        )}
        {/* Handle direct schema format (single type) */}
        {!schema.article && !schema.faq && schema['@type'] && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({ '@context': 'https://schema.org', ...schema }),
            }}
          />
        )}
      </>
    );
  } catch {
    // Invalid JSON, don't render anything
    return null;
  }
}

const beforeAfterPlaceholderRegex = /<div data-before-src="([^"]+)" data-after-src="([^"]+)" data-before-alt="([^"]*)" data-after-alt="([^"]*)"><\/div>/g;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function renderHtmlWithBeforeAfter(html: string) {
  const parts: Array<React.JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  beforeAfterPlaceholderRegex.lastIndex = 0;

  while ((match = beforeAfterPlaceholderRegex.exec(html)) !== null) {
    const [full, beforeSrc, afterSrc, beforeAlt, afterAlt] = match;
    const chunk = html.slice(lastIndex, match.index);

    if (chunk.trim()) {
      parts.push(
        <div key={`html-${match.index}`} dangerouslySetInnerHTML={{ __html: chunk }} />
      );
    }

    const decodedBeforeLabel = decodeHtml(beforeAlt) || 'Before';
    const decodedAfterLabel = decodeHtml(afterAlt) || 'After';
    parts.push(
      <div key={`ba-${match.index}`} className="not-prose my-8">
        <BeforeAfterSlider
          beforeSrc={decodeHtml(beforeSrc)}
          afterSrc={decodeHtml(afterSrc)}
          alt={`${decodedBeforeLabel} vs ${decodedAfterLabel}`}
          beforeLabel={decodedBeforeLabel}
          afterLabel={decodedAfterLabel}
          aspectRatio="4/3"
          size="md"
        />
      </div>
    );

    lastIndex = match.index + full.length;
  }

  const remaining = html.slice(lastIndex);
  if (remaining.trim()) {
    parts.push(
      <div key={`html-${lastIndex}`} dangerouslySetInnerHTML={{ __html: remaining }} />
    );
  }

  return parts;
}

export interface BlogPostContent {
  // Required metadata
  slug: string;
  locale: string;

  // Titles and descriptions
  title: string;
  description: string;
  breadcrumb: string;

  // Main content (HTML string)
  content: string;

  // Optional TL;DR points
  tldr?: string[];

  // Optional FAQs
  faqs?: Array<{ question: string; answer: string }>;
  faqTitle?: string;

  // Inline CTAs inserted at structural positions
  inlineCtas?: {
    afterTldr?: { headline: string; description: string; buttonText: string; href: string };
    midContent?: { headline: string; description: string; buttonText: string; href: string };
  };

  // CTA section
  cta?: {
    title: string;
    description: string;
    button: string;
    href?: string;
    socialProof?: {
      metric: string;
      metricEs?: string;
      description: string;
      descriptionEs?: string;
    };
  };

  // Author info
  author?: {
    name: string;
    title: string;
    bio: string;
    linkedInUrl?: string;
    initials?: string;
  };

  // Hero image config
  heroImage?: {
    alt: string;
    caption?: {
      en: string;
      es: string;
    };
    /** Optional explicit image path. Falls back to /blog/{slug}.png if not provided */
    src?: string;
  };

  // Dates
  datePublished: string;
  dateModified?: string;

  // Pre-generated schema from CMS (optional, falls back to dynamic generation)
  schemaJson?: string;
}

interface BlogPostTemplateProps {
  content: BlogPostContent;
}

/**
 * Unified blog post template that handles:
 * - SEO metadata (JSON-LD)
 * - Hero image display
 * - TL;DR section
 * - Main content rendering
 * - FAQ accordion
 * - CTA section
 * - Author box
 *
 * Usage in page.tsx:
 * ```tsx
 * export default async function MyBlogPost({ params }) {
 *   const content = getContent(locale, brandName);
 *   return <BlogPostTemplate content={content} />;
 * }
 * ```
 */
export async function BlogPostTemplate({ content }: BlogPostTemplateProps) {
  const headerList = await headers();
  const brandConfig = getBrand(headerList);
  const baseUrl = getBaseUrl(headerList);
  const brandCta = brandConfig.cta;

  const {
    slug,
    locale,
    title,
    description,
    breadcrumb,
    content: htmlContent,
    tldr,
    faqs = [],
    faqTitle = locale === 'es' ? 'Preguntas Frecuentes' : 'Frequently Asked Questions',
    cta,
    author = {
      name: 'Matthieu van Haperen',
      title: locale === 'es' ? `Fundador, ${brandConfig.name}` : `Founder, ${brandConfig.name}`,
      bio: locale === 'es'
        ? `Matthieu van Haperen es el fundador de ${brandConfig.name} y un ex venture builder con más de 6 años de experiencia en startups.`
        : `Matthieu van Haperen is the founder of ${brandConfig.name} and a former venture builder with 6+ years of startup experience.`,
      linkedInUrl: 'https://linkedin.com/in/matthieuvanhaperen',
      initials: 'MH',
    },
    heroImage,
    datePublished,
    dateModified,
    schemaJson,
  } = content;

  const defaultCta = {
    title: locale === 'es' ? `¿Listo para comenzar con ${brandConfig.name}?` : `Ready to get started with ${brandConfig.name}?`,
    description: locale === 'es' ? 'Genera headshots profesionales con IA en 60 segundos.' : 'Generate professional AI headshots in 60 seconds.',
    button: locale === 'es'
      ? (brandCta.primaryTextEs || brandCta.primaryText)
      : brandCta.primaryText,
    href: brandCta.pricingHref || brandCta.primaryHref,
    socialProof: brandCta.socialProof,
  };

  const ctaContent = {
    ...defaultCta,
    ...cta,
    href: cta?.href || defaultCta.href,
    button: cta?.button || defaultCta.button,
    socialProof: cta?.socialProof || defaultCta.socialProof,
  };

  const defaultInlineCta = {
    headline: locale === 'es'
      ? `Headshots profesionales desde $10.49`
      : `Professional headshots from $10.49`,
    description: locale === 'es'
      ? 'Sube una selfie. Obtén fotos profesionales en 60 segundos.'
      : 'Upload a selfie. Get studio-quality headshots in 60 seconds.',
    buttonText: locale === 'es'
      ? (brandCta.primaryTextEs || brandCta.primaryText)
      : brandCta.primaryText,
    href: ctaContent.href || defaultCta.href,
  };

  const afterTldrCta = content.inlineCtas?.afterTldr || defaultInlineCta;
  const midContentCta = content.inlineCtas?.midContent || defaultInlineCta;

  return (
    <>
      {/* Structured Data - use stored schema if available, otherwise generate dynamically */}
      {schemaJson ? (
        <StoredSchemaJsonLd schemaJson={schemaJson} />
      ) : (
        <>
          <ArticleJsonLd
            headline={title}
            description={description}
            authorName={author.name}
            authorUrl={author.linkedInUrl || 'https://linkedin.com/in/matthieuvanhaperen'}
            authorJobTitle={author.title}
            publisherName={brandConfig.name}
            publisherUrl={baseUrl}
            datePublished={datePublished}
            dateModified={dateModified}
            url={`${baseUrl}${locale === 'en' ? '' : '/' + locale}/blog/${slug}`}
            image={heroImage ? `${baseUrl}${heroImage.src || `/blog/${slug}.png`}` : undefined}
          />
          {faqs.length > 0 && <FaqJsonLd items={faqs} />}
        </>
      )}

      {/* Breadcrumb */}
      <BreadcrumbJsonLd
        baseUrl={baseUrl}
        items={[
          { label: locale === 'es' ? 'Inicio' : 'Home', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: breadcrumb },
        ]}
      />
      <Breadcrumb
        items={[
          { label: locale === 'es' ? 'Inicio' : 'Home', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: breadcrumb },
        ]}
      />

      {/* Article Header */}
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
        {title}
      </h1>

      {/* Author byline */}
      <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
          {author.initials || 'MH'}
        </div>
        <div>
          <p className="font-medium text-gray-900">{author.name}</p>
          <p>{author.title} · {locale === 'es' ? `Actualizado ${formatDate(dateModified || datePublished, 'es')}` : `Updated ${formatDate(dateModified || datePublished, 'en')}`}</p>
        </div>
      </div>

      {/* TL;DR Section */}
      {tldr && tldr.length > 0 && (
        <TldrSection>
          {tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>
      )}

      {/* Inline CTA after TL;DR */}
      <InlineCTA {...afterTldrCta} variant="subtle" />

      {/* Hero Image */}
      {heroImage && (
        <BlogHeroImage
          slug={slug}
          alt={heroImage.alt}
          caption={heroImage.caption}
          locale={locale}
          src={heroImage.src}
        />
      )}

      {/* Main Content with mid-content CTA */}
      {(() => {
        const h2Regex = /(<h2[^>]*>)/gi;
        const h2Matches = [...htmlContent.matchAll(h2Regex)];
        const midIndex = Math.floor(h2Matches.length / 2);

        if (h2Matches.length >= 4 && h2Matches[midIndex]?.index) {
          const splitPoint = h2Matches[midIndex].index!;
          const firstHalf = htmlContent.slice(0, splitPoint);
          const secondHalf = htmlContent.slice(splitPoint);
          return (
            <>
              <div className="prose prose-lg max-w-none">
                {renderHtmlWithBeforeAfter(firstHalf)}
              </div>
              <InlineCTA {...midContentCta} variant="bold" />
              <div className="prose prose-lg max-w-none mb-12">
                {renderHtmlWithBeforeAfter(secondHalf)}
              </div>
            </>
          );
        }

        return (
          <div className="prose prose-lg max-w-none mb-12">
            {renderHtmlWithBeforeAfter(htmlContent)}
          </div>
        );
      })()}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{faqTitle}</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="border border-gray-200 rounded-lg group">
                <summary className="font-medium cursor-pointer p-4 flex items-center justify-between">
                  <span>{faq.question}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 text-gray-600">
                  <p>{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-center text-white mb-12">
        {ctaContent.socialProof && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>
              {locale === 'es' && ctaContent.socialProof.metricEs ? ctaContent.socialProof.metricEs : ctaContent.socialProof.metric}
            </span>
            <span className="opacity-80">
              {locale === 'es' && ctaContent.socialProof.descriptionEs ? ctaContent.socialProof.descriptionEs : ctaContent.socialProof.description}
            </span>
          </div>
        )}
        <h2 className="text-2xl font-bold mb-2">{ctaContent.title}</h2>
        <p className="mb-4 opacity-90">{ctaContent.description}</p>
        <Link
          href={ctaContent.href || defaultCta.href}
          className="inline-block bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          {ctaContent.button}
        </Link>
      </section>

      {/* Author Box */}
      <AuthorBox
        name={author.name}
        title={author.title}
        bio={author.bio}
        initials={author.initials}
        linkedInUrl={author.linkedInUrl}
      />
    </>
  );
}

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const months = locale === 'es'
    ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default BlogPostTemplate;
