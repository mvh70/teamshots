import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getLandingVariant } from '@/config/landing-content';
import { BLOG_POSTS } from '@/config/blog';
import BlogCard from '@/components/blog/BlogCard';

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

  // Only TeamShotsPro and IndividualShots have blogs
  if (variant !== 'teamshotspro' && variant !== 'individualshots') {
    notFound();
  }

  const t = await getTranslations('blog');

  // Filter posts for this domain
  const posts = BLOG_POSTS.filter((post) => post.allowedVariants.includes(variant));

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
        <p className="text-xl text-muted-foreground mb-12">{t('description')}</p>

        <div className="grid gap-8 md:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
