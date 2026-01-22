'use client'

import { BLOG_CATEGORIES, type BlogPostCategory, getCategoryLabel } from '@/config/blog'

interface CategoryTabsProps {
  categories: BlogPostCategory[]
  selectedCategory: BlogPostCategory | 'all'
  onCategoryChange: (category: BlogPostCategory | 'all') => void
  locale?: string
}

/**
 * Category filter tabs for the blog index page.
 * Allows filtering blog posts by category.
 */
export default function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
  locale = 'en',
}: CategoryTabsProps) {
  // Get unique categories that exist in the current posts
  const uniqueCategories = [...new Set(categories)]

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-2">
        {/* All Tab */}
        <button
          onClick={() => onCategoryChange('all')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
            selectedCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {locale === 'es' ? 'Todos' : 'All'}
        </button>

        {/* Category Tabs */}
        {uniqueCategories.map((category) => {
          const config = BLOG_CATEGORIES[category]
          const isSelected = selectedCategory === category

          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                isSelected
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getCategoryLabel(category, locale)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
