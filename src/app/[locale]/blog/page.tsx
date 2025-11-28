import type { Metadata } from 'next';
import Link from 'next/link';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Tips, guides, and insights about AI headshots, team photos, and professional branding.',
  alternates: {
    canonical: '/blog',
    languages: {
      'en': '/blog',
      'es': '/es/blog',
    },
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Blog post data - add new posts here
const posts = [
  {
    slug: 'best-ai-headshot-generators',
    title: 'Best AI Headshot Generators in 2025 (Compared)',
    description: 'We tested the top AI headshot generators for quality, speed, and price. TeamShotsPro, HeadshotPro, Aragon AI compared.',
    date: '2025-11-28',
    readTime: '8 min read',
  },
];

export default function BlogIndexPage() {
  return (
    <div>
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Blog</h1>
      <p className="text-xl text-gray-600 mb-12">
        Tips, guides, and insights about AI headshots, team photos, and professional branding.
      </p>

      <div className="space-y-8">
        {posts.map((post) => (
          <article key={post.slug} className="border-b border-gray-200 pb-8">
            <Link href={`/blog/${post.slug}`} className="group block">
              <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-brand-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-gray-600 mb-3">{post.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No posts yet. Check back soon!
        </p>
      )}
    </div>
  );
}

