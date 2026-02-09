import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { constructMetadata } from '@/lib/seo';
import { getLandingVariant } from '@/config/landing-content';
import { getBrand } from '@/config/brand';
import { BLOG_POSTS } from '@/config/blog';
import { BlogContent } from '@/components/blog';
import { getBlogPostsForVariant } from '@/lib/cms';
import { BlogIndexSchema } from './schema';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  // Fallback to teamshotspro if host missing (unlikely in prod) but good for safety
  const baseUrl = host ? `${protocol}://${host}` : 'https://teamshotspro.com';

  return constructMetadata({
    baseUrl,
    path: '/blog',
    locale,
    title: t('title'),
    description: t('description'),
  });
}

/**
 * Domain-aware blog index page
 * Dynamically reads published posts from CMS database.
 * Falls back to static config for posts not yet in CMS.
 */
export default async function BlogPage() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);
  const locale = await getLocale();
  const baseUrl = host ? `${protocol}://${host}` : 'https://teamshotspro.com';

  // Only TeamShotsPro and IndividualShots have blogs
  if (variant !== 'teamshotspro' && variant !== 'individualshots') {
    notFound();
  }

  const t = await getTranslations('blog');

  // Get brand name from brand config
  const brand = getBrand(headersList);
  const brandName = brand.name;

  // Get posts from CMS database (primary source)
  // Pass locale to filter out untranslated posts for Spanish
  const cmsPosts = getBlogPostsForVariant(variant, locale);
  const cmsSlugSet = new Set(cmsPosts.map((p) => p.slug));

  // Get static config posts not in CMS (fallback)
  const staticPosts = BLOG_POSTS.filter(
    (post) => post.allowedVariants.includes(variant) && !cmsSlugSet.has(post.slug)
  );

  // Merge: CMS posts first (newest), then static fallbacks
  const posts = [...cmsPosts, ...staticPosts];

  const title = t('title');
  const description = t('description');

  return (
    <>
      <BlogIndexSchema
        baseUrl={baseUrl}
        brandName={brandName}
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
        cta={{
          heading: t('cta.heading'),
          subheading: t('cta.subheading'),
          buttonText: t('cta.buttonText'),
        }}
      />
    </>
  );
}
