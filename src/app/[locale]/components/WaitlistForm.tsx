'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export default function WaitlistForm() {
  const t = useTranslations('waitlist');
  const locale = useLocale() as 'en' | 'es';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, locale }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(t('success'));
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || t('error'));
      }
    } catch {
      setStatus('error');
      setMessage(t('error'));
    }
  };

  return (
    <section id="waitlist" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-gradient-to-br from-brand-primary-lighter via-brand-primary-light to-brand-cta-light rounded-2xl shadow-2xl p-8 border border-brand-primary/30">
        {/* Urgency Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center bg-brand-cta text-white px-5 py-2.5 rounded-full text-base font-bold mb-4 shadow-lg">
            <span className="w-2.5 h-2.5 bg-white rounded-full mr-2 animate-pulse"></span>
            {t('limitedSpots')}
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-4 text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
          {t('subtitle')}
        </p>

    
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              className="flex-1 px-6 py-5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-lg bg-white shadow-sm text-gray-900"
              disabled={status === 'loading'}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-8 py-4 bg-brand-cta text-white font-semibold rounded-lg hover:bg-brand-cta-hover transition-all duration-300 disabled:bg-gray-400 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-lg min-w-[200px] flex items-center justify-center gap-2"
            >
              {status === 'loading' && (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {status === 'loading' ? t('submitting') : t('submitFirstPerson')}
            </button>
          </div>

          {/* Risk Reduction Elements */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mt-4">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('guarantee')}
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t('secure')}
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('noSpam')}
            </div>
          </div>
        </form>

        {message && (
          <div
            className={`mt-6 p-4 rounded-lg text-center ${
              status === 'success' 
                ? 'bg-brand-secondary-light text-brand-secondary-text-light border border-brand-secondary-lighter' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center justify-center">
              {status === 'success' ? (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {message}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center bg-brand-primary-light text-brand-primary px-4 py-2 rounded-full">
            <span className="w-2 h-2 bg-brand-secondary rounded-full mr-2 animate-pulse"></span>
            {t('joinedBadge')}
          </div>
        </div>
      </div>
    </section>
  );
}

