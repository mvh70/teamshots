'use client'

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlogPost } from '@/config/blog';
import { BLOG_CATEGORIES, getBlogPostTitle, getBlogPostDescription, getCategoryLabel, formatReadTime } from '@/config/blog';

interface BlogCardProps {
  post: BlogPost;
  locale?: string;
}

/**
 * Blog post card component for the blog index page.
 * Displays a preview of a blog post with image, category, title, description, and metadata.
 */
export default function BlogCard({ post, locale = 'en' }: BlogCardProps) {
  const categoryConfig = BLOG_CATEGORIES[post.category];
  const [imageError, setImageError] = useState(false);
  const title = getBlogPostTitle(post, locale);
  const description = getBlogPostDescription(post, locale);

  return (
    <article className="group">
      <Link href={`/blog/${post.slug}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-[16/9] mb-4 rounded-xl overflow-hidden bg-gray-100">
          {post.image && !imageError ? (
            <Image
              src={post.image}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-primary/5 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-brand-primary/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Category Badge */}
        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-3 ${categoryConfig.color}`}>
          {getCategoryLabel(post.category, locale)}
        </span>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 group-hover:text-brand-primary transition-colors mb-2 line-clamp-2">
          {title}
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-3 line-clamp-2">{description}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {post.date && (
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </time>
          )}
          {post.date && post.readTime && <span>·</span>}
          {post.readTime && (
            <span>
              {(() => {
                const minutes = parseInt(post.readTime.match(/\d+/)?.[0] || '0', 10)
                return formatReadTime(minutes, locale)
              })()}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
