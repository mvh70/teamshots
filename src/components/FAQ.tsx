'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getBrandContact } from '@/config/brand';
import { getClientDomain, getSignupTypeFromDomain, getForcedSignupType } from '@/lib/domain';
import { PRICING_CONFIG } from '@/config/pricing';
import { calculatePhotosFromCredits, formatPrice } from '@/domain/pricing/utils';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function FAQ() {
  const t = useTranslations('faq');
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Detect domain signup type for domain-specific FAQ answers
  const [domainSignupType] = useState<'individual' | 'team' | null>(() => {
    if (typeof window === 'undefined') return null;
    const domain = getClientDomain();
    const forcedType = getForcedSignupType();
    return forcedType || getSignupTypeFromDomain(domain);
  });

  // Calculate pricing values for FAQ interpolation
  const individualPhotos = calculatePhotosFromCredits(PRICING_CONFIG.individual.credits);
  const individualVariations = 1 + PRICING_CONFIG.regenerations.individual;
  const individualTotalPhotos = individualPhotos * individualVariations;
  
  const proSmallPhotos = calculatePhotosFromCredits(PRICING_CONFIG.proSmall.credits);
  const proSmallVariations = 1 + PRICING_CONFIG.regenerations.proSmall;
  const proSmallTotalPhotos = proSmallPhotos * proSmallVariations;
  
  const proLargePhotos = calculatePhotosFromCredits(PRICING_CONFIG.proLarge.credits);
  const proLargeVariations = 1 + PRICING_CONFIG.regenerations.proLarge;
  const proLargeTotalPhotos = proLargePhotos * proLargeVariations;
  
  const maxVariations = Math.max(individualVariations, proSmallVariations, proLargeVariations);

  // Prepare pricing values for interpolation
  const pricingValues = {
    individualPrice: formatPrice(PRICING_CONFIG.individual.price),
    individualPhotos: individualTotalPhotos.toString(),
    proSmallPrice: formatPrice(PRICING_CONFIG.proSmall.price),
    proSmallPhotos: proSmallTotalPhotos.toString(),
    proLargePrice: formatPrice(PRICING_CONFIG.proLarge.price),
    proLargePhotos: proLargeTotalPhotos.toString(),
    maxVariations: maxVariations.toString(),
  };

  // Get domain-specific answer key with fallback to base answer
  const getAnswerKey = (itemId: string, baseKey: string) => {
    const faqData = t.raw(`items.${itemId}`) as Record<string, string> | undefined;
    
    if (domainSignupType === 'team') {
      const teamKey = `${baseKey}Team`;
      // Check if the team-specific key exists in the raw data
      if (faqData && teamKey in faqData) {
        return teamKey;
      }
    } else if (domainSignupType === 'individual') {
      const individualKey = `${baseKey}Individual`;
      // Check if the individual-specific key exists in the raw data
      if (faqData && individualKey in faqData) {
        return individualKey;
      }
    }
    // Fall back to base answer key
    return baseKey;
  };

  const FAQ_ITEMS: FAQItem[] = [
    {
      id: '1',
      question: t('items.1.question'),
      answer: t('items.1.answer'),
      category: 'technical'
    },
    {
      id: '2',
      question: t('items.2.question'),
      answer: t(`items.2.${getAnswerKey('2', 'answer')}`, pricingValues),
      category: 'technical'
    },
    {
      id: '3',
      question: t('items.3.question'),
      answer: t('items.3.answer'),
      category: 'pricing'
    },
    {
      id: '4',
      question: t('items.4.question'),
      answer: t('items.4.answer'),
      category: 'privacy'
    },
    {
      id: '5',
      question: t('items.5.question'),
      answer: t('items.5.answer'),
      category: 'pricing'
    },
    {
      id: '6',
      question: t('items.6.question'),
      answer: t('items.6.answer'),
      category: 'usage'
    },
    {
      id: '7',
      question: t('items.7.question'),
      answer: t('items.7.answer'),
      category: 'technical'
    }
  ];

  const categories = ['all', 'technical', 'pricing', 'privacy', 'usage'];

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const filteredItems = FAQ_ITEMS.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-gray-50 relative grain-texture">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6 leading-tight">
            {t('title')}
          </h2>
          <p className="text-lg sm:text-xl text-text-body max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(`category.${category}`)}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border-2 border-brand-primary-lighter/30 rounded-2xl overflow-hidden hover:shadow-depth-lg hover:border-brand-primary-lighter transition-all duration-300 bg-bg-white"
            >
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-brand-primary-light/30 transition-all duration-300 rounded-2xl"
              >
                <h3 className="font-semibold text-text-dark pr-4 text-lg leading-snug">
                  {item.question}
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${
                    openItems.includes(item.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {openItems.includes(item.id) && (
                <div className="px-6 pb-6">
                  <div className="pt-4 border-t-2 border-brand-primary-lighter/30">
                    <p className="text-text-body leading-relaxed text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {t('noResults')}
            </p>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            {t('stillHaveQuestions')}
          </p>
            <a
              href={`mailto:${getBrandContact().support}`}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white rounded-2xl hover:shadow-depth-lg transition-all duration-300 shadow-depth-md transform hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t('contactSupport')}
          </a>
        </div>
      </div>
    </section>
  );
}
