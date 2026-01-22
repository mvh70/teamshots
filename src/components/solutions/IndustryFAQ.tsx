'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Search, X } from 'lucide-react'

interface FAQProps {
  industry: string
}

// FAQ category detection based on keywords
type FAQCategory = 'all' | 'quality' | 'pricing' | 'process' | 'security'

function categorizeQuestion(question: string, answer: string): FAQCategory {
  const text = `${question} ${answer}`.toLowerCase()

  if (text.includes('price') || text.includes('cost') || text.includes('discount') || text.includes('billing') || text.includes('pay')) {
    return 'pricing'
  }
  if (text.includes('quality') || text.includes('professional') || text.includes('standard') || text.includes('resolution')) {
    return 'quality'
  }
  if (text.includes('security') || text.includes('privacy') || text.includes('data') || text.includes('confidential') || text.includes('soc 2')) {
    return 'security'
  }
  if (text.includes('upload') || text.includes('process') || text.includes('step') || text.includes('how') || text.includes('work')) {
    return 'process'
  }

  return 'all'
}

export function IndustryFAQ({ industry }: FAQProps) {
  const t = useTranslations(`solutions.${industry}.faq`)
  const tShared = useTranslations('faq')
  const items = t.raw('items') as Array<{ question: string; answer: string }>

  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>('all')

  // Categorize all FAQ items
  const categorizedItems = useMemo(() => {
    return items.map((item, originalIndex) => ({
      ...item,
      category: categorizeQuestion(item.question, item.answer),
      originalIndex,
    }))
  }, [items])

  // Get unique categories that have items
  const availableCategories = useMemo(() => {
    const categories = new Set(categorizedItems.map(item => item.category))
    return ['all', ...Array.from(categories).filter(c => c !== 'all')] as FAQCategory[]
  }, [categorizedItems])

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    return categorizedItems.filter(item => {
      const matchesSearch = searchQuery === '' ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [categorizedItems, searchQuery, selectedCategory])

  const categoryLabels: Record<FAQCategory, string> = {
    all: tShared('categories.all'),
    quality: tShared('categories.quality'),
    pricing: tShared('categories.pricing'),
    process: tShared('categories.process'),
    security: tShared('categories.security'),
  }

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-text-dark mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-text-body">
            {tShared('subtitle')}
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-8 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder={tShared('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 rounded-xl border border-bg-gray-200 bg-bg-white text-text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Category Filters */}
          {availableCategories.length > 2 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {availableCategories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-bg-white text-text-body border border-bg-gray-200 hover:border-brand-primary/40'
                  }`}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted">No questions found matching your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                }}
                className="mt-4 text-brand-primary font-medium hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.originalIndex}
                className="rounded-2xl border border-bg-gray-100 bg-bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === item.originalIndex ? null : item.originalIndex)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-bg-gray-50 transition-colors"
                >
                  <span className="text-base sm:text-lg font-semibold text-text-dark pr-4">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 ${
                      openIndex === item.originalIndex ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    openIndex === item.originalIndex ? 'max-h-[500px]' : 'max-h-0'
                  }`}
                >
                  <p className="px-6 pb-5 text-text-body leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Results Count */}
        {searchQuery && filteredItems.length > 0 && (
          <p className="text-center mt-6 text-sm text-text-muted">
            Showing {filteredItems.length} of {items.length} questions
          </p>
        )}
      </div>
    </section>
  )
}
