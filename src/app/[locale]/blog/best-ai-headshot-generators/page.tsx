import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getBrand } from '@/config/brand';
import { getBaseUrl } from '@/lib/url';
import {
  ArticleJsonLd,
  FaqJsonLd,
  AuthorBox,
  TldrSection,
  Breadcrumb,
} from '@/components/blog';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const brandConfig = getBrand(headersList);

  return {
    title: 'Best AI Headshot Generators in 2025 (Compared)',
    description: `We tested the top AI headshot generators for quality, speed, and price. ${brandConfig.name}, HeadshotPro, Aragon AI compared.`,
    openGraph: {
      title: 'Best AI Headshot Generators in 2025 (Compared)',
      description:
        'We tested the top AI headshot generators for quality, speed, and price.',
      type: 'article',
      publishedTime: '2025-11-28',
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      canonical: '/blog/best-ai-headshot-generators',
      languages: {
        en: '/blog/best-ai-headshot-generators',
        es: '/es/blog/best-ai-headshot-generators',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const faqItemsTemplate = (brandName: string) => [
  {
    question: 'What is the best AI headshot generator in 2025?',
    answer: `For teams needing consistent headshots, ${brandName} is the best choice with 60-second generation. For individuals, HeadshotPro and Aragon AI offer high-quality results at $29+.`,
  },
  {
    question: 'How much do AI headshots cost?',
    answer: `AI headshots typically cost $15-50 per person, compared to $200-500 for traditional photography. ${brandName} offers team pricing, while HeadshotPro starts at $29 per person.`,
  },
  {
    question: 'Are AI headshots good enough for LinkedIn?',
    answer:
      'Yes, modern AI headshot generators produce professional-quality photos suitable for LinkedIn, company websites, and business cards. The best tools are indistinguishable from professional photography.',
  },
  {
    question: 'How long does it take to generate AI headshots?',
    answer: `Generation time varies by tool: ${brandName} takes about 60 seconds, Try It On AI takes 30 minutes, and HeadshotPro/Aragon take 1-2 hours.`,
  },
];

export default async function BestAIHeadshotGeneratorsPage({ params }: Props) {
  await params; // Consume params for Next.js
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const baseUrl = getBaseUrl(headersList);
  const faqItems = faqItemsTemplate(brandConfig.name);

  return (
    <>
      <ArticleJsonLd
        headline="Best AI Headshot Generators in 2025"
        description={`A comprehensive comparison of AI headshot generators including ${brandConfig.name}, HeadshotPro, and Aragon AI.`}
        authorName="Matthieu van Haperen"
        authorUrl="https://linkedin.com/in/yourprofile"
        authorJobTitle={`Founder, ${brandConfig.name}`}
        publisherName={brandConfig.name}
        publisherUrl={baseUrl}
        datePublished="2025-11-28"
        url={`${baseUrl}/blog/best-ai-headshot-generators`}
      />
      <FaqJsonLd items={faqItems} />

      <article>
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: 'Best AI Headshot Generators' },
          ]}
        />

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Best AI Headshot Generators in 2025
        </h1>

        {/* Author byline - E-E-A-T signal for GEO */}
        <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
            MH
          </div>
          <div>
            <p className="font-medium text-gray-900">Matthieu van Haperen</p>
            <p>Founder, {brandConfig.name} · Updated Nov 2025</p>
          </div>
        </div>

        <TldrSection>
          <p>
            <strong>Best for teams:</strong> {brandConfig.name} — generates matching
            headshots for entire teams in 60 seconds.
          </p>
          <p>
            <strong>Best for individuals:</strong> HeadshotPro — high quality
            results at $29 per person, but takes 2+ hours.
          </p>
          <p>
            <strong>Best budget option:</strong> Try It On AI — starts at $15,
            30-minute turnaround, decent quality.
          </p>
        </TldrSection>

        {/* Comparison Table */}
        <h2 id="comparison" className="text-2xl font-bold mt-12 mb-6 text-gray-900">
          AI Headshot Generator Comparison
        </h2>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 p-3 text-left font-semibold">
                  Tool
                </th>
                <th className="border border-gray-200 p-3 text-left font-semibold">
                  Best For
                </th>
                <th className="border border-gray-200 p-3 text-left font-semibold">
                  Price
                </th>
                <th className="border border-gray-200 p-3 text-left font-semibold">
                  Speed
                </th>
                <th className="border border-gray-200 p-3 text-left font-semibold">
                  Quality
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 p-3 font-medium">
                  {brandConfig.name}
                </td>
                <td className="border border-gray-200 p-3">Teams & consistency</td>
                <td className="border border-gray-200 p-3">From $49/team</td>
                <td className="border border-gray-200 p-3">60 seconds</td>
                <td className="border border-gray-200 p-3">⭐⭐⭐⭐⭐</td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-3 font-medium">
                  HeadshotPro
                </td>
                <td className="border border-gray-200 p-3">Individuals</td>
                <td className="border border-gray-200 p-3">$29+</td>
                <td className="border border-gray-200 p-3">2 hours</td>
                <td className="border border-gray-200 p-3">⭐⭐⭐⭐⭐</td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-3 font-medium">
                  Aragon AI
                </td>
                <td className="border border-gray-200 p-3">Style variety</td>
                <td className="border border-gray-200 p-3">$29+</td>
                <td className="border border-gray-200 p-3">1-2 hours</td>
                <td className="border border-gray-200 p-3">⭐⭐⭐⭐</td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-3 font-medium">
                  Try It On AI
                </td>
                <td className="border border-gray-200 p-3">Budget</td>
                <td className="border border-gray-200 p-3">$15+</td>
                <td className="border border-gray-200 p-3">30 min</td>
                <td className="border border-gray-200 p-3">⭐⭐⭐</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Our Product Section */}
        <h2 id="our-product" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          1. {brandConfig.name} — Best for Teams
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>Price:</strong> From $49 per team
            </li>
            <li>
              <strong>Speed:</strong> 60 seconds
            </li>
            <li>
              <strong>Best for:</strong> Companies needing consistent team photos
            </li>
            <li>
              <strong>Website:</strong> {brandConfig.domain}
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {brandConfig.name} solves a problem other AI headshot tools ignore:
          consistency across a team. When each person uploads photos separately
          to tools like HeadshotPro, you get wildly different lighting,
          backgrounds, and styles. {brandConfig.name} generates matching headshots
          that look like everyone visited the same photographer.
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          The 60-second generation time is also significantly faster than
          competitors who take hours. For startups and remote teams who need
          professional photos quickly, this is the best option.
        </p>

        {/* HeadshotPro Section */}
        <h2 id="headshotpro" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          2. HeadshotPro
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>Price:</strong> $29+ per person
            </li>
            <li>
              <strong>Speed:</strong> 2+ hours
            </li>
            <li>
              <strong>Best for:</strong> Individual professionals
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          HeadshotPro is one of the most established AI headshot generators.
          They produce high-quality individual headshots with multiple background
          and style options. Quality is excellent, but the per-person pricing
          adds up quickly for teams.
        </p>

        {/* Aragon Section */}
        <h2 id="aragon" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          3. Aragon AI
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>Price:</strong> $29+ per person
            </li>
            <li>
              <strong>Speed:</strong> 1-2 hours
            </li>
            <li>
              <strong>Best for:</strong> Creative professionals wanting variety
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          Aragon offers more style variety than competitors, including casual
          and creative options beyond standard corporate headshots. Good choice
          if you need photos for different contexts.
        </p>

        {/* FAQ Section */}
        <h2 id="faq" className="text-2xl font-bold mt-16 mb-6 text-gray-900">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <div key={index}>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">
                {item.question}
              </h3>
              <p className="text-gray-700">{item.answer}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 p-8 bg-gray-50 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Ready to create professional team headshots?
          </h2>
          <p className="mb-6 text-gray-600">
            Get matching headshots for your entire team in 60 seconds.
          </p>
          <Link
            href="/"
            className="inline-block bg-brand-cta text-white px-8 py-4 rounded-lg hover:bg-brand-cta-hover transition-colors font-medium"
          >
            Try {brandConfig.name} Free →
          </Link>
        </div>

        <AuthorBox
          name="Matthieu van Haperen"
          title={`Founder, ${brandConfig.name}`}
          bio={`Matthieu van Haperen is the founder of ${brandConfig.name} and a former venture builder with 6+ years of experience in startups. He writes about AI tools, productivity, and building in public.`}
          linkedInUrl="https://linkedin.com/in/yourprofile"
        />
      </article>
    </>
  );
}
