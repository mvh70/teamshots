'use client'

import { useState, useMemo } from 'react'
import type { BlogPost, BlogPostCategory } from '@/config/blog'
import BlogCard from './BlogCard'
import FeaturedPost from './FeaturedPost'
import CategoryTabs from './CategoryTabs'
import BlogCTA from './BlogCTA'

interface BlogContentProps {
  posts: BlogPost[]
  title: string
  description: string
}

/**
 * Client-side blog content component with filtering.
 * Handles category filtering and displays featured post, grid, and CTA.
 */
export default function BlogContent({ posts, title, description }: BlogContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<BlogPostCategory | 'all'>('all')

  // Find the featured post (first one marked as featured, or newest post)
  const featuredPost = useMemo(() => {
    return posts.find((post) => post.featured) || posts[0]
  }, [posts])

  // Get all categories from posts
  const allCategories = useMemo(() => {
    return posts.map((post) => post.category)
  }, [posts])

  // Filter posts based on selected category (exclude featured post from grid)
  const filteredPosts = useMemo(() => {
    let filtered = posts.filter((post) => post.slug !== featuredPost?.slug)

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((post) => post.category === selectedCategory)
    }

    return filtered
  }, [posts, selectedCategory, featuredPost])

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-xl text-muted-foreground">{description}</p>
        </div>

        {/* Featured Post */}
        {featuredPost && <FeaturedPost post={featuredPost} />}

        {/* Category Filter */}
        <CategoryTabs
          categories={allCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        {/* Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No posts found in this category.</p>
          </div>
        )}

        {/* CTA Section */}
        <BlogCTA />
      </div>
    </div>
  )
}
