'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBlogPostDescription, getBlogPostTitle, type BlogPost, type BlogPostCategory } from '@/config/blog'
import BlogCard from './BlogCard'
import FeaturedPost from './FeaturedPost'
import CategoryTabs from './CategoryTabs'
import BlogCTA from './BlogCTA'

interface BlogContentProps {
  posts: BlogPost[]
  title: string
  description: string
  locale?: string
  initialSearchQuery?: string
  cta?: {
    heading: string
    subheading: string
    buttonText: string
  }
}

/**
 * Client-side blog content component with filtering.
 * Handles category filtering and displays featured post, grid, and CTA.
 */
export default function BlogContent({
  posts,
  title,
  description,
  locale = 'en',
  initialSearchQuery = '',
  cta,
}: BlogContentProps) {
  const tSearch = useTranslations('blog.search')
  const [selectedCategory, setSelectedCategory] = useState<BlogPostCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  useEffect(() => {
    setSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    const url = new URL(window.location.href)

    if (trimmedQuery) {
      url.searchParams.set('q', trimmedQuery)
    } else {
      url.searchParams.delete('q')
    }

    const nextUrl = `${url.pathname}${url.search}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [searchQuery])

  const searchMatchedPosts = useMemo(() => {
    if (!normalizedSearchQuery) {
      return posts
    }

    return posts.filter((post) => {
      const localizedTitle = getBlogPostTitle(post, locale).toLowerCase()
      const localizedDescription = getBlogPostDescription(post, locale).toLowerCase()
      return localizedTitle.includes(normalizedSearchQuery) || localizedDescription.includes(normalizedSearchQuery)
    })
  }, [locale, normalizedSearchQuery, posts])

  // Find the featured post (first one marked as featured, or newest post)
  const featuredPost = useMemo(() => {
    return searchMatchedPosts.find((post) => post.featured) || searchMatchedPosts[0]
  }, [searchMatchedPosts])

  // Get all categories from posts
  const allCategories = useMemo(() => {
    return searchMatchedPosts.map((post) => post.category)
  }, [searchMatchedPosts])

  // Filter posts based on selected category (exclude featured post from grid)
  const filteredPosts = useMemo(() => {
    let filtered = searchMatchedPosts.filter((post) => post.slug !== featuredPost?.slug)

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((post) => post.category === selectedCategory)
    }

    return filtered
  }, [searchMatchedPosts, selectedCategory, featuredPost])

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-xl text-muted-foreground">{description}</p>
        </div>

        {/* Featured Post */}
        {featuredPost && <FeaturedPost post={featuredPost} locale={locale} />}

        {/* Search */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={tSearch('placeholder')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tSearch('clear')}
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <CategoryTabs
          categories={allCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          locale={locale}
        />

        {/* Empty state for search */}
        {normalizedSearchQuery && searchMatchedPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <p className="text-gray-600">{tSearch('noResults', { query: searchQuery.trim() })}</p>
          </div>
        ) : filteredPosts.length > 0 ? (
          /* Posts Grid */
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} locale={locale} />
            ))}
          </div>
        ) : selectedCategory !== 'all' || !featuredPost ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {locale === 'es' ? 'No se encontraron publicaciones en esta categoría.' : 'No posts found in this category.'}
            </p>
          </div>
        ) : null}

        {/* CTA Section */}
        <BlogCTA
          heading={cta?.heading}
          subheading={cta?.subheading}
          buttonText={cta?.buttonText}
        />
      </div>
    </div>
  )
}
