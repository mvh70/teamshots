'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export default function InlineWaitlist() {
  const t = useTranslations('waitlist');
  const locale = useLocale() as 'en' | 'es';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Error');
      setEmail('');
      setMessage(t('success'));
    } catch {
      setMessage(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('emailPlaceholder')}
        className="flex-1 px-5 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white text-gray-900"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-4 bg-brand-cta text-white font-semibold rounded-lg hover:bg-brand-cta-hover transition-all disabled:bg-gray-400"
      >
        {loading ? t('submitting') : t('submitFirstPerson')}
      </button>
      {message && (
        <div className="w-full text-center text-sm text-gray-700 sm:mt-0 mt-1">{message}</div>
      )}
    </form>
  );
}

