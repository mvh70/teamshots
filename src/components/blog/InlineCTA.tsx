import { Link } from '@/i18n/routing';

interface InlineCTAProps {
  headline: string;
  description: string;
  buttonText: string;
  href: string;
  variant?: 'subtle' | 'bold';
}

export function InlineCTA({
  headline,
  description,
  buttonText,
  href,
  variant = 'subtle',
}: InlineCTAProps) {
  if (variant === 'bold') {
    return (
      <section className="my-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-1">{headline}</p>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <Link
          href={href}
          className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          {buttonText}
        </Link>
      </section>
    );
  }

  return (
    <aside className="my-6 border-l-4 border-indigo-400 bg-indigo-50/50 pl-4 py-3 rounded-r-lg">
      <p className="text-sm font-medium text-gray-900">{headline}</p>
      <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      <Link
        href={href}
        className="inline-block mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
      >
        {buttonText} &rarr;
      </Link>
    </aside>
  );
}
