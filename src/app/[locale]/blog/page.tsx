import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { getLandingVariant } from '@/config/landing-content';
import { BLOG_POSTS } from '@/config/blog';
import { BlogContent } from '@/components/blog';

export async function generateMetadata() {
  const t = await getTranslations('blog');
  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * Domain-aware blog index page
 * Shows different blog posts based on the domain
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

  // Filter posts for this domain and convert to mutable array
  const posts = [...BLOG_POSTS.filter((post) => post.allowedVariants.includes(variant))];

  return (
    <BlogContent
      posts={posts}
      title={t('title')}
      description={t('description')}
      locale={locale}
    />
  );
}
