'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PRICING_CONFIG } from '@/config/pricing';
import { calculatePhotosFromCredits, formatPrice } from '@/domain/pricing/utils';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { LandingVariant } from '@/config/landing-content';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface FAQProps {
  /** Landing page variant for domain-specific content (from server) */
  variant: LandingVariant;
  /** Support email from server */
  supportEmail: string;
}

export default function FAQ({ variant, supportEmail }: FAQProps) {
  // Use domain-specific translations for title/subtitle
  const tLanding = useTranslations(`landing.${variant}.faq`);
  // Use legacy translations for FAQ items (complex structure)
  const t = useTranslations('faq');
  const { track } = useAnalytics();
  // Auto-expand the differentiator FAQ
  const [openItems, setOpenItems] = useState<string[]>(['8']);

  // Derive signup type from server-provided variant (no client-side detection)
  const domainSignupType: 'individual' | 'team' | null =
    variant === 'individualshots' ? 'individual' :
    variant === 'teamshotspro' ? 'team' :
    null;

  // Calculate pricing values for FAQ interpolation
  const individualPhotos = calculatePhotosFromCredits(PRICING_CONFIG.individual.credits);
  const individualVariations = 1 + PRICING_CONFIG.regenerations.individual;
  const individualTotalPhotos = individualPhotos * individualVariations;

  const vipPhotos = calculatePhotosFromCredits(PRICING_CONFIG.vip.credits);
  const vipVariations = 1 + PRICING_CONFIG.regenerations.vip;
  const vipTotalPhotos = vipPhotos * vipVariations;

  const maxVariations = Math.max(individualVariations, vipVariations);

  // Prepare pricing values for interpolation
  const pricingValues = {
    individualPrice: formatPrice(PRICING_CONFIG.individual.price),
    individualPhotos: individualTotalPhotos.toString(),
    vipPrice: formatPrice(PRICING_CONFIG.vip.price),
    vipPhotos: vipTotalPhotos.toString(),
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

  // Ordered by visitor mental journey: quality → process → differentiation → pricing → usage → privacy → enterprise
  const FAQ_ITEMS: FAQItem[] = [
    {
      id: '3',
      question: t('items.3.question'),
      answer: t('items.3.answer'),
      category: 'pricing'
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
      answer: t.raw('items.7.answer') as string,
      category: 'technical'
    },
    {
      id: '8',
      question: t('items.8.question'),
      answer: t('items.8.answer'),
      category: 'technical'
    },
    {
      id: '2',
      question: t('items.2.question'),
      answer: t(`items.2.${getAnswerKey('2', 'answer')}`, pricingValues),
      category: 'technical'
    },
    {
      id: '4',
      question: t('items.4.question'),
      answer: t('items.4.answer'),
      category: 'privacy'
    },
    {
      id: '1',
      question: t('items.1.question'),
      answer: t('items.1.answer'),
      category: 'technical'
    },
    {
      id: '9',
      question: t('items.9.question'),
      answer: t('items.9.answer'),
      category: 'technical'
    },
    {
      id: '10',
      question: t('items.10.question'),
      answer: t('items.10.answer'),
      category: 'technical'
    }
  ];

  const toggleItem = (id: string, question: string, category: string) => {
    const isOpening = !openItems.includes(id);

    if (isOpening) {
      track('faq_question_opened', {
        question_id: id,
        question_text: question,
        category,
        page: 'landing',
      });
    }

    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const filteredItems = FAQ_ITEMS;

  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-bg-gray-50 relative grain-texture">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark mb-6 leading-tight">
            {tLanding('title')}
          </h2>
          <p className="text-lg sm:text-xl text-text-body max-w-2xl mx-auto leading-relaxed">
            {tLanding('subtitle')}
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border-2 border-brand-primary-lighter/30 rounded-2xl overflow-hidden hover:shadow-depth-lg hover:border-brand-primary-lighter transition-all duration-300 bg-bg-white"
            >
              <button
                onClick={() => toggleItem(item.id, item.question, item.category)}
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
                    <p className="text-text-body leading-relaxed text-base [&_a]:text-brand-primary [&_a]:underline [&_a]:hover:text-brand-primary-hover [&_a]:transition-colors"
                      dangerouslySetInnerHTML={{ __html: item.answer }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            {t('stillHaveQuestions')}
          </p>
            <a
              href={`mailto:${supportEmail}`}
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
