import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { getLandingVariant } from '@/config/landing-content';
import { BLOG_POSTS } from '@/config/blog';
import { BlogContent } from '@/components/blog';
import { getBlogPostsForVariant } from '@/lib/cms';

export async function generateMetadata() {
  const t = await getTranslations('blog');
  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * Domain-aware blog index page
 * Dynamically reads published posts from CMS database.
 * Falls back to static config for posts not yet in CMS.
 */
export default async function BlogPage() {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined;
  const variant = getLandingVariant(domain);
  const locale = await getLocale();

  // Only TeamShotsPro and IndividualShots have blogs
  if (variant !== 'teamshotspro' && variant !== 'individualshots') {
    notFound();
  }

  const t = await getTranslations('blog');

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

  return (
    <BlogContent
      posts={posts}
      title={t('title')}
      description={t('description')}
      locale={locale}
      cta={{
        heading: t('cta.heading'),
        subheading: t('cta.subheading'),
        buttonText: t('cta.buttonText'),
      }}
    />
  );
}
