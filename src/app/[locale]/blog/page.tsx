import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { constructMetadata } from '@/lib/seo';
import { getBrandByDomain } from '@/config/brand';
import { getTenant } from '@/config/tenant-server';
import { BLOG_POSTS } from '@/config/blog';
import { BlogContent } from '@/components/blog';
import { getBlogPostsForBrand } from '@/lib/cms';
import { BlogIndexSchema } from './schema';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const tenant = await getTenant();
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = host ? `${protocol}://${host}` : `https://${tenant.domain}`;

  return constructMetadata({
    baseUrl,
    path: '/blog',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

type BlogPageProps = {
  searchParams: Promise<{ q?: string | string[] }>
}

/**
 * Domain-aware blog index page
 * Dynamically reads published posts from CMS database.
 * Falls back to static config for posts not yet in CMS.
 */
export default async function BlogPage({ searchParams }: BlogPageProps) {
  const tenant = await getTenant();
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const variant = tenant.landingVariant;
  const locale = await getLocale();
  const baseUrl = host ? `${protocol}://${host}` : `https://${tenant.domain}`;

  if (!tenant.features.blog) {
    notFound();
  }

  const t = await getTranslations('blog');

  const brand = getBrandByDomain(tenant.domain);

  // Get posts from CMS database (primary source)
  // Pass locale to filter out untranslated posts for Spanish
  const cmsPosts = getBlogPostsForBrand(tenant.cmsBrandId, variant, locale);
  const cmsSlugSet = new Set(cmsPosts.map((p) => p.slug));

  // Get static config posts not in CMS (fallback)
  const staticPosts = BLOG_POSTS.filter(
    (post) => post.allowedVariants.includes(variant) && !cmsSlugSet.has(post.slug)
  );

  // Merge: CMS posts first (newest), then static fallbacks
  const posts = [...cmsPosts, ...staticPosts];

  const title = t('title');
  const description = t('description');
  const { q } = await searchParams;
  const initialSearchQuery = Array.isArray(q) ? (q[0] ?? '') : (q ?? '');

  return (
    <>
      <BlogIndexSchema
        baseUrl={baseUrl}
        brand={brand}
        locale={locale}
        variant={variant}
        title={title}
        description={description}
        posts={posts}
      />
      <BlogContent
        posts={posts}
        title={title}
        description={description}
        locale={locale}
        initialSearchQuery={initialSearchQuery}
        cta={{
          heading: t('cta.heading'),
          subheading: t('cta.subheading'),
          buttonText: t('cta.buttonText'),
        }}
      />
    </>
  );
}
