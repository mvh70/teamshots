'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { BlogPost } from '@/config/blog'
import { BLOG_CATEGORIES, getBlogPostTitle, getBlogPostDescription } from '@/config/blog'

interface FeaturedPostProps {
  post: BlogPost
  locale?: string
}

/**
 * Hero section component for featured blog posts.
 * Displays a large featured image with overlay text.
 */
export default function FeaturedPost({ post, locale = 'en' }: FeaturedPostProps) {
  const categoryConfig = BLOG_CATEGORIES[post.category]
  const [imageError, setImageError] = useState(false)
  const title = getBlogPostTitle(post, locale)
  const description = getBlogPostDescription(post, locale)

  return (
    <Link href={`/blog/${post.slug}`} className="group block mb-12">
      <article className="relative overflow-hidden rounded-2xl bg-gray-900" style={{ minHeight: '320px' }}>
        {/* Background Image or Gradient Fallback */}
        {post.image && !imageError ? (
          <Image
            src={post.image}
            alt={title}
            fill
            className="object-cover opacity-60 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
            priority
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-brand-primary/70 to-gray-900" />
        )}

        {/* Content Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />

        {/* Text Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-10">
          <div className="max-w-3xl">
            {/* Category Badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-white/20 text-white backdrop-blur-sm">
                Featured
              </span>
              <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${categoryConfig.color}`}>
                {categoryConfig.label}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 group-hover:text-brand-primary transition-colors">
              {title}
            </h2>

            {/* Description */}
            <p className="text-gray-200 text-base md:text-lg mb-4 line-clamp-2">
              {description}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-300">
              {post.author && (
                <span className="font-medium">{post.author}</span>
              )}
              {post.date && (
                <>
                  <span>·</span>
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </>
              )}
              {post.readTime && (
                <>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
